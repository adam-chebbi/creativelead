import { Router, Request, Response } from 'express';
import { z } from 'zod';
import Groq from 'groq-sdk';
import axios from 'axios';
import { prisma } from '../../lib/prisma';
import { decrypt } from '../../lib/encryption';

export const outreachRouter = Router();

const GenerateSchema = z.object({
  lead: z.object({
    id:       z.string(),
    name:     z.string(),
    address:  z.string().default(''),
    city:     z.string().default(''),
    category: z.string().default(''),
  }),
  language: z.enum(['english','greek','arabic']).default('english'),
  template: z.string().optional(),
});

const SendSchema = z.object({
  businessId:   z.string().optional(),
  businessName: z.string(),
  toEmail:      z.string().email(),
  subject:      z.string().min(1).max(500),
  body:         z.string().min(1),
  language:     z.enum(['english','greek','arabic']).default('english'),
});

function buildHtml(bodyHtml: string, unsubUrl: string): string {
  return `<!DOCTYPE html><html><head><meta charset="UTF-8"><style>
    body{margin:0;padding:24px 12px;background:#080f0f;font-family:'Inter',Arial,sans-serif;}
    .wrap{max-width:560px;margin:0 auto;background:#0d1a1a;border-radius:12px;overflow:hidden;border:1px solid rgba(78,205,196,0.12);}
    .accent{height:2px;background:linear-gradient(to right,transparent,#4ecdc4,#e8806a,transparent);}
    .hdr{background:#060e0e;padding:22px 32px;border-bottom:1px solid rgba(78,205,196,0.08);}
    .hdr h1{color:#fff;font-size:14px;font-weight:600;letter-spacing:2.5px;text-transform:uppercase;margin:0;}
    .hdr p{color:#4a7a7a;font-size:11px;margin:2px 0 0;}
    .body{padding:32px;color:#c8dede;font-size:14.5px;line-height:1.8;}
    .divider{height:1px;background:linear-gradient(to right,transparent,rgba(78,205,196,0.15),transparent);margin:0 32px;}
    .footer{padding:18px 32px;display:flex;align-items:center;justify-content:space-between;flex-wrap:wrap;gap:10px;}
    .footer-left{color:#3a6060;font-size:11px;line-height:1.5;}
    .unsub{display:inline-block;padding:5px 14px;border:1px solid rgba(78,205,196,0.2);border-radius:20px;color:#4a7070;font-size:10px;font-weight:500;letter-spacing:1px;text-transform:uppercase;text-decoration:none;}
  </style></head><body>
  <div class="wrap">
    <div class="accent"></div>
    <div class="hdr"><h1>AutoReach</h1><p>Digital Presence · Web Design · Marketing</p></div>
    <div class="body"><p>${bodyHtml}</p></div>
    <div class="divider"></div>
    <div class="footer">
      <div class="footer-left">You received this because your business was publicly listed.<br>We respect your inbox.</div>
      <a href="${unsubUrl}" class="unsub">Unsubscribe</a>
    </div>
  </div></body></html>`;
}

/** POST /api/dashboard/outreach/generate — AI email via Groq */
outreachRouter.post('/generate', async (req: Request, res: Response): Promise<void> => {
  const parsed = GenerateSchema.safeParse(req.body);
  if (!parsed.success) { res.status(400).json({ error: 'Invalid body', details: parsed.error.flatten() }); return; }

  const { lead, language, template } = parsed.data;

  try {
    const settings = await prisma.userSettings.findUnique({ where: { userId: req.userId }, select: { groqApiKeyEncrypted: true } });
    let groqKey = process.env.GROQ_API_KEY;
    try { if (settings?.groqApiKeyEncrypted) groqKey = decrypt(settings.groqApiKeyEncrypted); } catch (e) {}
    if (!groqKey) { res.status(400).json({ error: 'Groq API key not configured. Add it in Settings.' }); return; }

    const groq = new Groq({ apiKey: groqKey });
    let prompt: string, subject: string;

    if (language === 'arabic') {
      prompt = template
        ? `اكتب بريدًا إلكترونيًا للتواصل البارد بالعربية للشركة '${lead.name}' (${lead.address}). استخدم هذا القالب كأساس: ${template}. القواعد: لا تترك عناصر نائبة، وقّع باسم 'كونستانتينوس'، أقل من 120 كلمة، أعد نص البريد فقط.`
        : `اكتب بريدًا إلكترونيًا قصيرًا وطبيعيًا للتواصل البارد بالعربية للشركة '${lead.name}' الموجودة في ${lead.address}. أنت مستقل يقدم خدمات تصميم الويب والتسويق الرقمي. القواعد: خاطب الشركة بالاسم، اكتب بضمير المتكلم، لا تترك عناصر نائبة، وقّع باسم 'كونستانتينوس'، أقل من 120 كلمة، أعد نص البريد فقط بدون سطر الموضوع.`;
      subject = `فكرة لـ ${lead.name}`;
    } else if (language === 'greek') {
      prompt = template
        ? `Γράψε ένα cold outreach email στα ελληνικά για την επιχείρηση '${lead.name}' (${lead.address}). Χρησιμοποίησε αυτό το template ως βάση: ${template}. Κανόνες: ΜΗΝ αφήνεις placeholders, υπόγραψε ως 'Κωνσταντίνος', κάτω από 120 λέξεις, επέστρεψε μόνο το κείμενο.`
        : `Γράψε ένα σύντομο, φυσικό cold outreach email στα ελληνικά προς την επιχείρηση '${lead.name}' (${lead.address}). Είσαι freelancer που προσφέρει web design και digital marketing. Κανόνες: απευθύνσου ονομαστικά, γράψε σαν άτομο (εγώ/μου), ΜΗΝ αφήνεις placeholders, υπόγραψε ως 'Κωνσταντίνος', κάτω από 120 λέξεις, επέστρεψε ΜΟΝΟ το κείμενο χωρίς θέμα.`;
      subject = `Μια ιδέα για ${lead.name}`;
    } else {
      prompt = template
        ? `Write a cold outreach email to '${lead.name}' (${lead.address}). Use this template as a base: ${template}. Rules: no placeholders, sign off as 'Konstantinos', under 120 words, return only the email body.`
        : `Write a short, natural cold outreach email to '${lead.name}' located at ${lead.address}. You are a freelancer offering web design and digital marketing. Rules: address by name, write as a person (I/my), no placeholders, sign off as 'Konstantinos', under 120 words, return ONLY the email body, no subject line.`;
      subject = `Quick idea for ${lead.name}`;
    }

    const completion = await groq.chat.completions.create({
      model: 'llama-3.1-8b-instant',
      messages: [{ role: 'user', content: prompt }],
      temperature: 0.7,
      max_tokens: 400,
    });

    res.json({ subject, body: completion.choices[0]?.message?.content?.trim() || '', language });
  } catch (err) {
    console.error('[outreach/generate]', err);
    res.status(500).json({ error: 'Failed to generate email' });
  }
});

/** POST /api/dashboard/outreach/send — send via Resend (server-side key) */
outreachRouter.post('/send', async (req: Request, res: Response): Promise<void> => {
  const parsed = SendSchema.safeParse(req.body);
  if (!parsed.success) { res.status(400).json({ error: 'Invalid body', details: parsed.error.flatten() }); return; }

  const { businessId, businessName, toEmail, subject, body, language } = parsed.data;

  try {
    const settings = await prisma.userSettings.findUnique({ where: { userId: req.userId }, select: { resendApiKeyEncrypted: true, resendFromEmail: true } });
    let resendKey = process.env.RESEND_API_KEY;
    try { if (settings?.resendApiKeyEncrypted) resendKey = decrypt(settings.resendApiKeyEncrypted); } catch (e) {}
    const fromEmail = settings?.resendFromEmail || process.env.RESEND_FROM_EMAIL || 'onboarding@resend.dev';
    if (!resendKey) { res.status(400).json({ error: 'Resend API key not configured. Add it in Settings.' }); return; }

    const baseUrl = process.env.APP_BASE_URL || 'https://app.autoreach.dev';
    const unsubUrl = `${baseUrl}/unsubscribe?email=${encodeURIComponent(toEmail)}`;
    const html = buildHtml(body.replace(/\n/g, '<br>'), unsubUrl);

    const resp = await axios.post(
      'https://api.resend.com/emails',
      { from: fromEmail, to: [toEmail], subject, html },
      { headers: { Authorization: `Bearer ${resendKey}`, 'Content-Type': 'application/json' }, timeout: 15000 }
    );

    if (resp.status !== 200 && resp.status !== 201) {
      res.status(500).json({ error: `Resend error: ${JSON.stringify(resp.data)}` }); return;
    }

    await prisma.sentEmail.create({
      data: { userId: req.userId, businessId: businessId || null, businessName, toEmail, subject, body, language, status: 'sent', senderEmail: fromEmail },
    });

    if (businessId) {
      prisma.business.updateMany({ where: { id: businessId, userId: req.userId, stage: 'New' }, data: { stage: 'Contacted' } }).catch(() => {});
    }

    res.json({ ok: true });
  } catch (err) {
    console.error('[outreach/send]', err);
    res.status(500).json({ error: err instanceof Error ? err.message : 'Failed to send email' });
  }
});

/** GET /api/dashboard/outreach/sent — paginated sent log */
outreachRouter.get('/sent', async (req: Request, res: Response): Promise<void> => {
  const page  = parseInt((req.query.page  as string) || '1',  10);
  const limit = Math.min(parseInt((req.query.limit as string) || '50', 10), 100);
  try {
    const [total, emails] = await Promise.all([
      prisma.sentEmail.count({ where: { userId: req.userId } }),
      prisma.sentEmail.findMany({
        where: { userId: req.userId },
        orderBy: { sentAt: 'desc' },
        skip: (page - 1) * limit,
        take: limit,
        select: { id: true, businessName: true, toEmail: true, subject: true, sentAt: true, language: true, status: true, senderEmail: true },
      }),
    ]);
    const formattedEmails = emails.map(e => ({
      ...e,
      email: e.toEmail,
      dateSent: e.sentAt,
      fromEmail: e.senderEmail
    }));
    res.json({ data: formattedEmails, pagination: { page, limit, total, totalPages: Math.ceil(total / limit) } });
  } catch (err) {
    console.error('[outreach/sent]', err);
    res.status(500).json({ error: 'Failed to fetch sent emails' });
  }
});
