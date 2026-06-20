import { Router } from 'express';
import { Webhook } from 'svix';
import { prisma } from '../../lib/prisma';

export const resendWebhookRouter = Router();

// This route must be mounted BEFORE express.json() so it receives the raw buffer
resendWebhookRouter.post('/', async (req, res) => {
  const secret = process.env.RESEND_WEBHOOK_SECRET;
  if (!secret) {
    console.error('[WEBHOOK] RESEND_WEBHOOK_SECRET is not set');
    return res.status(500).json({ error: 'Server misconfiguration' });
  }

  const payload = (req as any).rawBody || req.body.toString('utf8');
  const headers = {
    'svix-id': req.headers['svix-id'] as string,
    'svix-timestamp': req.headers['svix-timestamp'] as string,
    'svix-signature': req.headers['svix-signature'] as string,
  };

  let event;
  try {
    const wh = new Webhook(secret);
    event = wh.verify(payload, headers) as any;
  } catch (err: any) {
    console.error('[WEBHOOK] Signature verification failed:', err.message);
    return res.status(400).json({ error: 'Invalid signature' });
  }

  const { type, data } = event;
  console.log(`[WEBHOOK] Received Resend event: ${type}`);

  // Handle bounces, complaints, and replies
  if (['email.bounced', 'email.complained', 'email.replied'].includes(type)) {
    const emailTo = data.to?.[0]; // Usually who the email was addressed to (or from in case of replies if mapped)
    let targetEmail = emailTo;
    
    // For bounced/complained, the target is the recipient (to).
    // For replies, the target is the sender (from).
    if (type === 'email.replied') {
      targetEmail = data.from;
    }

    if (targetEmail) {
      try {
        const business = await prisma.business.findFirst({
          where: { email: targetEmail },
          orderBy: { createdAt: 'desc' }
        });

        if (business) {
          const newStage = type === 'email.replied' ? 'Replied' : 'Unsubscribed';
          
          await prisma.business.update({
            where: { id: business.id },
            data: { 
              stage: newStage,
              unsubscribed: newStage === 'Unsubscribed' ? true : business.unsubscribed
            }
          });

          // Cancel any pending follow-ups for this business
          await prisma.followupLog.updateMany({
            where: { businessId: business.id, status: 'pending' },
            data: { status: 'skipped' }
          });

          console.log(`[WEBHOOK] Updated business ${business.id} to stage ${newStage}`);
        }
      } catch (err) {
        console.error('[WEBHOOK] Failed to update business from webhook:', err);
      }
    }
  }

  return res.status(200).json({ received: true });
});
