import { getSettings } from '../hooks/useSettingsStore';

export type SendResult = { ok: true; providerId: string } | { ok: false; error: string };

export async function sendEmail(
  to: string,
  subject: string,
  body: string
): Promise<SendResult> {
  const settings = getSettings();
  const p = settings.providers;

  if (!p.emailSmtpHost || !p.emailSmtpUser || !p.emailSmtpPass || !p.emailFromAddress) {
    return { ok: false, error: 'Email provider not configured. Go to Settings to set SMTP credentials.' };
  }

  // Use SendGrid Web API v3 (most common transactional email) as primary transport.
  // Falls back to generic SMTP via a mail-sending proxy when available.
  // SendGrid API is the primary path since SMTP submission from browser is not directly possible.
  try {
    const res = await fetch('https://api.sendgrid.com/v3/mail/send', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Authorization': `Bearer ${p.emailSmtpPass}`,
      },
      body: JSON.stringify({
        personalizations: [{ to: [{ email: to }], subject }],
        from: { email: p.emailFromAddress, name: p.emailFromName || undefined },
        content: [{ type: 'text/plain', value: body }],
      }),
    });

    if (res.ok) return { ok: true, providerId: 'sendgrid' };

    const errBody = await res.text();
    if (res.status === 401) return { ok: false, error: 'SendGrid auth failed. Check your API key in Settings.' };
    if (res.status === 429) return { ok: false, error: 'SendGrid rate limit hit. Wait and retry.' };
    return { ok: false, error: `SendGrid error (${res.status}): ${errBody.slice(0, 200)}` };
  } catch (err) {
    // Try Resend as fallback
    try {
      const res2 = await fetch('https://api.resend.com/emails', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${p.emailSmtpPass}`,
        },
        body: JSON.stringify({
          from: p.emailFromAddress,
          to: [to],
          subject,
          text: body,
        }),
      });

      if (res2.ok) return { ok: true, providerId: 'resend' };
      const err2 = await res2.text();
      return { ok: false, error: `Email send failed (SendGrid+Resend). Last error: ${err2.slice(0, 200)}` };
    } catch (err2) {
      const msg = err instanceof Error ? err.message : 'SendGrid network error';
      const msg2 = err2 instanceof Error ? err2.message : 'Resend network error';
      return { ok: false, error: `Email failed: ${msg}; fallback: ${msg2}` };
    }
  }
}

export async function sendSms(
  to: string,
  body: string
): Promise<SendResult> {
  const settings = getSettings();
  const p = settings.providers;

  if (!p.twilioAccountSid || !p.twilioAuthToken || !p.twilioSmsFromNumber) {
    return { ok: false, error: 'Twilio SMS not configured. Go to Settings to set account SID, auth token, and from number.' };
  }

  const encoded = new URLSearchParams();
  encoded.append('To', to);
  encoded.append('From', p.twilioSmsFromNumber);
  encoded.append('Body', body);

  try {
    const res = await fetch(
      `https://api.twilio.com/2010-04-01/Accounts/${p.twilioAccountSid}/Messages.json`,
      {
        method: 'POST',
        headers: {
          'Content-Type': 'application/x-www-form-urlencoded',
          'Authorization': 'Basic ' + btoa(`${p.twilioAccountSid}:${p.twilioAuthToken}`),
        },
        body: encoded,
      }
    );

    if (res.ok) return { ok: true, providerId: 'twilio-sms' };

    const errBody = await res.json();
    const msg = errBody?.message || errBody?.error_message || await res.text();
    if (res.status === 401) return { ok: false, error: 'Twilio auth failed. Check account SID and auth token in Settings.' };
    if (res.status === 429 || res.status === 20429) return { ok: false, error: 'Twilio rate limit hit. Wait and retry.' };
    if (res.status === 21211) return { ok: false, error: `Invalid phone number: ${to}` };
    return { ok: false, error: `Twilio SMS error: ${msg.slice(0, 200)}` };
  } catch (err) {
    return { ok: false, error: 'Network error sending SMS: ' + (err instanceof Error ? err.message : 'Unknown') };
  }
}

export async function sendWhatsApp(
  to: string,
  body: string
): Promise<SendResult> {
  const settings = getSettings();
  const p = settings.providers;

  if (!p.twilioAccountSid || !p.twilioAuthToken || !p.twilioWhatsAppFromNumber) {
    return { ok: false, error: 'WhatsApp provider not configured. Go to Settings to set Twilio credentials and WhatsApp from number.' };
  }

  const encoded = new URLSearchParams();
  encoded.append('To', `whatsapp:${to}`);
  encoded.append('From', `whatsapp:${p.twilioWhatsAppFromNumber}`);
  encoded.append('Body', body);

  try {
    const res = await fetch(
      `https://api.twilio.com/2010-04-01/Accounts/${p.twilioAccountSid}/Messages.json`,
      {
        method: 'POST',
        headers: {
          'Content-Type': 'application/x-www-form-urlencoded',
          'Authorization': 'Basic ' + btoa(`${p.twilioAccountSid}:${p.twilioAuthToken}`),
        },
        body: encoded,
      }
    );

    if (res.ok) return { ok: true, providerId: 'twilio-whatsapp' };

    const errBody = await res.json();
    const msg = errBody?.message || errBody?.error_message || await res.text();
    if (res.status === 401) return { ok: false, error: 'Twilio WhatsApp auth failed. Check Settings.' };
    if (res.status === 63018) return { ok: false, error: `WhatsApp number not opted in: ${to}` };
    if (res.status === 14104) return { ok: false, error: 'WhatsApp sender not approved. Check your Twilio WhatsApp sender.' };
    return { ok: false, error: `Twilio WhatsApp error: ${msg.slice(0, 200)}` };
  } catch (err) {
    return { ok: false, error: 'Network error sending WhatsApp: ' + (err instanceof Error ? err.message : 'Unknown') };
  }
}

export function getRecipientFromLead(lead: any, channel: 'email' | 'sms' | 'whatsapp'): string | null {
  if (channel === 'email') {
    const email = lead.email || (lead.emails?.[0]) || null;
    return email;
  }
  const phone = lead.phone_number || lead.phone || null;
  if (!phone) return null;

  // Normalize phone to E.164
  let cleaned = phone.replace(/[^\d+]/g, '');
  if (cleaned.startsWith('+')) return cleaned;
  if (cleaned.startsWith('00')) return '+' + cleaned.slice(2);
  if (cleaned.length === 10) return '+1' + cleaned;
  if (cleaned.length === 11 && cleaned.startsWith('1')) return '+' + cleaned;
  return '+' + cleaned;
}