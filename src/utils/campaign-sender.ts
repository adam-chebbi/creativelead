import { getSettings } from '../hooks/useSettingsStore';

export type SendResult = { ok: true; providerId: string } | { ok: false; error: string };

async function sendViaSendGrid(to: string, subject: string, body: string, apiKey: string, fromEmail: string, fromName?: string): Promise<SendResult> {
  const res = await fetch('https://api.sendgrid.com/v3/mail/send', {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      'Authorization': `Bearer ${apiKey}`,
    },
    body: JSON.stringify({
      personalizations: [{ to: [{ email: to }], subject }],
      from: { email: fromEmail, name: fromName || undefined },
      content: [{ type: 'text/plain', value: body }],
    }),
  });
  if (res.ok) return { ok: true, providerId: 'sendgrid' };
  const errBody = await res.text();
  if (res.status === 401) return { ok: false, error: 'SendGrid auth failed. Check your API key in Settings.' };
  if (res.status === 429) return { ok: false, error: 'SendGrid rate limit hit. Wait and retry.' };
  return { ok: false, error: `SendGrid error (${res.status}): ${errBody.slice(0, 200)}` };
}

async function sendViaResend(to: string, subject: string, body: string, apiKey: string, fromEmail: string): Promise<SendResult> {
  const res = await fetch('https://api.resend.com/emails', {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      'Authorization': `Bearer ${apiKey}`,
    },
    body: JSON.stringify({
      from: fromEmail,
      to: [to],
      subject,
      text: body,
    }),
  });
  if (res.ok) return { ok: true, providerId: 'resend' };
  const errBody = await res.text();
  return { ok: false, error: `Resend error (${res.status}): ${errBody.slice(0, 200)}` };
}

async function sendViaGmailSmtp(to: string, subject: string, body: string, gmailAddress: string, appPassword: string): Promise<SendResult> {
  try {
    const res = await fetch('/api/email/send-smtp', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        host: 'smtp.gmail.com',
        port: 587,
        secure: false,
        user: gmailAddress,
        pass: appPassword,
        from: gmailAddress,
        to,
        subject,
        text: body,
      }),
    });
    const data = await res.json();
    if (res.ok) return { ok: true, providerId: 'gmail-smtp' };
    return { ok: false, error: data.error || `Gmail SMTP error (${res.status})` };
  } catch (err) {
    return { ok: false, error: 'Gmail SMTP network error: ' + (err instanceof Error ? err.message : 'Unknown') };
  }
}

export async function sendEmail(
  to: string,
  subject: string,
  body: string
): Promise<SendResult> {
  const settings = getSettings();
  const p = settings.providers;

  switch (p.emailProvider) {
    case 'gmail': {
      if (!p.gmailAddress || !p.gmailAppPassword) {
        return { ok: false, error: 'Gmail not configured. Set your Gmail address and App Password in Settings.' };
      }
      return sendViaGmailSmtp(to, subject, body, p.gmailAddress, p.gmailAppPassword);
    }
    case 'resend': {
      if (!p.resendApiKey || !p.emailFromAddress) {
        return { ok: false, error: 'Resend not configured. Set your Resend API Key and From Email in Settings.' };
      }
      return sendViaResend(to, subject, body, p.resendApiKey, p.emailFromAddress);
    }
    case 'smtp': {
      if (!p.emailSmtpHost || !p.emailSmtpUser || !p.emailSmtpPass || !p.emailFromAddress) {
        return { ok: false, error: 'SMTP not configured. Set SMTP host, user, password, and From Email in Settings.' };
      }
      try {
        const res = await fetch('/api/email/send-smtp', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            host: p.emailSmtpHost,
            port: p.emailSmtpPort,
            secure: p.emailSmtpPort === 465,
            user: p.emailSmtpUser,
            pass: p.emailSmtpPass,
            from: p.emailFromAddress,
            fromName: p.emailFromName || undefined,
            to,
            subject,
            text: body,
          }),
        });
        const data = await res.json();
        if (res.ok) return { ok: true, providerId: 'smtp' };
        return { ok: false, error: data.error || `SMTP error (${res.status})` };
      } catch (err) {
        return { ok: false, error: 'SMTP network error: ' + (err instanceof Error ? err.message : 'Unknown') };
      }
    }
    default: {
      if (!p.emailSmtpPass || !p.emailFromAddress) {
        return { ok: false, error: 'Email provider not configured. Go to Settings to set credentials.' };
      }
      return sendViaSendGrid(to, subject, body, p.emailSmtpPass, p.emailFromAddress, p.emailFromName);
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

  let cleaned = phone.replace(/[^\d+]/g, '');
  if (cleaned.startsWith('+')) return cleaned;
  if (cleaned.startsWith('00')) return '+' + cleaned.slice(2);
  if (cleaned.length === 10) return '+1' + cleaned;
  if (cleaned.length === 11 && cleaned.startsWith('1')) return '+' + cleaned;
  return '+' + cleaned;
}
