import cron from 'node-cron';
import Groq from 'groq-sdk';
import axios from 'axios';
import { prisma } from '../lib/prisma';

/**
 * Follow-up Cron Job — runs every hour.
 *
 * Finds pending FollowupLog entries whose scheduledFor <= now,
 * generates AI copy (EN/EL/AR), sends via Resend, marks as sent.
 * Always checks unsubscribed flag and step-enabled settings.
 */
export function startFollowupCron(): void {
  cron.schedule('0 * * * *', async () => {
    console.log('[CRON] Follow-up job started at', new Date().toISOString());
    try { await processFollowups(); }
    catch (err) { console.error('[CRON] Follow-up job error:', err); }
  });
}

async function processFollowups(): Promise<void> {
  const due = await prisma.followupLog.findMany({
    where: { status: 'pending', scheduledFor: { lte: new Date() } },
    include: {
      user: { select: { id: true, settings: { select: {
        groqApiKey: true, resendApiKey: true, resendFromEmail: true,
        followupStep3Enabled: true, followupStep7Enabled: true, followupStep14Enabled: true,
      }}}},
      business: { select: { id: true, name: true, address: true, email: true, unsubscribed: true, stage: true } },
    },
    take: 100,
  });

  if (due.length === 0) { console.log('[CRON] No follow-ups due.'); return; }
  console.log(`[CRON] Processing ${due.length} follow-up(s)`);

  let sent = 0, skipped = 0, failed = 0;

  for (const f of due) {
    try {
      // Skip unsubscribed or replied leads
      if (f.business?.unsubscribed || f.business?.stage === 'Replied') {
        await prisma.followupLog.update({ where: { id: f.id }, data: { status: 'skipped' } });
        skipped++; continue;
      }

      // Check step enabled
      const s = f.user.settings;
      const stepEnabled = [s?.followupStep3Enabled ?? true, s?.followupStep7Enabled ?? true, s?.followupStep14Enabled ?? true][f.followupStep - 1];
      if (!stepEnabled) {
        await prisma.followupLog.update({ where: { id: f.id }, data: { status: 'skipped' } });
        skipped++; continue;
      }

      const groqKey  = s?.groqApiKey    || process.env.GROQ_API_KEY;
      const resendKey = s?.resendApiKey  || process.env.RESEND_API_KEY;
      const fromEmail = s?.resendFromEmail || process.env.RESEND_FROM_EMAIL || 'onboarding@resend.dev';

      if (!groqKey || !resendKey) { skipped++; continue; }

      const { subject, body } = await generateFollowup({
        groqKey,
        name:    f.businessName,
        address: f.business?.address || '',
        step:    f.followupStep,
        lang:    f.language,
      });

      const baseUrl = process.env.APP_BASE_URL || 'https://app.autoreach.dev';
      const unsubUrl = `${baseUrl}/unsubscribe?email=${encodeURIComponent(f.email)}`;
      const html = buildHtml(body.replace(/\n/g, '<br>'), unsubUrl);

      await axios.post(
        'https://api.resend.com/emails',
        { from: fromEmail, to: [f.email], subject, html },
        { headers: { Authorization: `Bearer ${resendKey}`, 'Content-Type': 'application/json' }, timeout: 15000 }
      );

      await prisma.followupLog.update({
        where: { id: f.id },
        data: { status: 'sent', subject, body, dateSent: new Date() },
      });

      sent++;
      console.log(`[CRON] ✓ Follow-up #${f.followupStep} → ${f.email}`);
      await sleep(3000);
    } catch (err) {
      console.error(`[CRON] Failed follow-up ${f.id}:`, err);
      failed++;
    }
  }

  console.log(`[CRON] Done — sent:${sent} skipped:${skipped} failed:${failed}`);
}

async function generateFollowup(opts: {
  groqKey: string; name: string; address: string; step: number; lang: string;
}): Promise<{ subject: string; body: string }> {
  const { groqKey, name, address, step, lang } = opts;
  const groq = new Groq({ apiKey: groqKey });

  const toneEn: Record<number,string> = {
    1: 'a gentle, friendly follow-up',
    2: 'a slightly more direct follow-up',
    3: 'a final, brief follow-up — mention this is the last you will reach out',
  };

  let prompt: string, subject: string;

  if (lang === 'arabic') {
    const toneAr: Record<number,string> = { 1:'متابعة لطيفة ودية', 2:'متابعة أكثر مباشرة', 3:'متابعة أخيرة وموجزة — اذكر أن هذه آخر رسالة' };
    prompt = `اكتب ${toneAr[step]||'متابعة'} بالعربية للشركة '${name}' (${address}). أشر إلى أنك أرسلت بريدًا سابقًا ولم تتلقَّ ردًا. القواعد: خاطب بالاسم، ضمير المتكلم، لا عناصر نائبة، وقّع باسم 'كونستانتينوس'، أقل من 100 كلمة، نص البريد فقط.`;
    const subAr: Record<number,string> = { 1:`متابعة — ${name}`, 2:`هل أنت مهتم؟ — ${name}`, 3:`رسالتي الأخيرة لـ ${name}` };
    subject = subAr[step] || `متابعة — ${name}`;
  } else if (lang === 'greek') {
    prompt = `Γράψε ${toneEn[step]||'a follow-up'} email στα ελληνικά για την επιχείρηση '${name}' (${address}). Αναφέρου ότι έστειλες προηγούμενο email χωρίς απάντηση. Κανόνες: ονομαστικά, πρώτο πρόσωπο, ΜΗΝ αφήνεις placeholders, υπόγραψε ως 'Κωνσταντίνος', κάτω από 100 λέξεις, μόνο το κείμενο.`;
    const subEl: Record<number,string> = { 1:`Re: Μια ιδέα για ${name}`, 2:`Τελευταία επικοινωνία — ${name}`, 3:`Τελευταίο μήνυμα για ${name}` };
    subject = subEl[step] || `Follow-up — ${name}`;
  } else {
    prompt = `Write ${toneEn[step]||'a follow-up'} email to '${name}' (${address}). Reference that you sent a previous email but haven't heard back. Rules: address by name, first person (I/my), no placeholders, sign off as 'Konstantinos', under 100 words, return only the email body.`;
    const subEn: Record<number,string> = { 1:`Following up — ${name}`, 2:`Still interested? — ${name}`, 3:`Last message for ${name}` };
    subject = subEn[step] || `Follow-up — ${name}`;
  }

  const completion = await groq.chat.completions.create({
    model: 'llama-3.1-8b-instant',
    messages: [{ role: 'user', content: prompt }],
    temperature: 0.7,
    max_tokens: 300,
  });

  return { subject, body: completion.choices[0]?.message?.content?.trim() || '' };
}

function buildHtml(bodyHtml: string, unsubUrl: string): string {
  return `<!DOCTYPE html><html><head><meta charset="UTF-8"><style>
    body{margin:0;padding:24px 12px;background:#080f0f;font-family:'Inter',Arial,sans-serif;}
    .wrap{max-width:560px;margin:0 auto;background:#0d1a1a;border-radius:12px;overflow:hidden;border:1px solid rgba(78,205,196,0.12);}
    .accent{height:2px;background:linear-gradient(to right,transparent,#4ecdc4,#e8806a,transparent);}
    .hdr{background:#060e0e;padding:22px 32px;}
    .hdr h1{color:#fff;font-size:14px;font-weight:600;letter-spacing:2.5px;text-transform:uppercase;margin:0;}
    .body{padding:32px;color:#c8dede;font-size:14.5px;line-height:1.8;}
    .footer{padding:18px 32px;display:flex;align-items:center;justify-content:space-between;}
    .footer-left{color:#3a6060;font-size:11px;}
    .unsub{padding:5px 14px;border:1px solid rgba(78,205,196,0.2);border-radius:20px;color:#4a7070;font-size:10px;text-decoration:none;}
  </style></head><body>
  <div class="wrap">
    <div class="accent"></div>
    <div class="hdr"><h1>AutoReach</h1></div>
    <div class="body"><p>${bodyHtml}</p></div>
    <div class="footer">
      <div class="footer-left">You received this because your business was publicly listed.</div>
      <a href="${unsubUrl}" class="unsub">Unsubscribe</a>
    </div>
  </div></body></html>`;
}

function sleep(ms: number): Promise<void> {
  return new Promise((r) => setTimeout(r, ms));
}
