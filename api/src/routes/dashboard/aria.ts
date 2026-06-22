import { Router, Request, Response } from 'express';
import { z } from 'zod';
import Groq from 'groq-sdk';
import { prisma } from '../../lib/prisma';
import { decrypt } from '../../lib/encryption';

export const ariaRouter = Router();

const AriaSchema = z.object({
  messages: z.array(z.object({
    role: z.enum(['system', 'user', 'assistant']),
    content: z.string(),
  })),
});

/** POST /api/dashboard/aria */
ariaRouter.post('/', async (req: Request, res: Response): Promise<void> => {
  const parsed = AriaSchema.safeParse(req.body);
  if (!parsed.success) { res.status(400).json({ error: 'Invalid body' }); return; }

  try {
    const settings = await prisma.userSettings.findUnique({ where: { userId: req.userId }, select: { groqApiKeyEncrypted: true } });
    let groqKey = process.env.GROQ_API_KEY;
    try { if (settings?.groqApiKeyEncrypted) groqKey = decrypt(settings.groqApiKeyEncrypted); } catch (e) {}
    
    if (!groqKey) { res.status(400).json({ error: 'Groq API key not configured. Add it in Settings.' }); return; }

    const groq = new Groq({ apiKey: groqKey });
    
    // Inject system prompt if not present
    const messages = [...parsed.data.messages];
    if (messages[0]?.role !== 'system') {
      messages.unshift({
        role: 'system',
        content: 'You are ARIA (Automated Reach & Intelligence Assistant). You help the user write cold outreach emails, analyze local business leads, and provide sales advice. Be concise, professional, and directly helpful.'
      });
    }

    const completion = await groq.chat.completions.create({
      model: 'llama-3.1-8b-instant',
      messages,
      temperature: 0.7,
      max_tokens: 800,
    });

    res.json({ message: completion.choices[0]?.message?.content?.trim() || '' });
  } catch (err) {
    console.error('[aria]', err);
    res.status(500).json({ error: 'Failed to chat with ARIA' });
  }
});
