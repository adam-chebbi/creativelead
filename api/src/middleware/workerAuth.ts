import { Request, Response, NextFunction } from 'express';
import { prisma } from '../lib/prisma';

declare global {
  namespace Express {
    interface Request {
      userId: string;
      userEmail: string;
      workerSessionId?: string;
    }
  }
}

/**
 * Worker Authentication Middleware
 *
 * Reads: Authorization: Bearer <WORKER_TOKEN>
 * Required headers from worker:
 *   X-Machine-Name  — hostname of the worker machine
 *   X-Platform      — windows | macos | linux
 *   X-Worker-Version — semver string
 *
 * On success: attaches userId, userEmail, workerSessionId to req.
 * Upserts a WorkerSession record and marks stale sessions offline.
 */
export async function workerAuth(
  req: Request,
  res: Response,
  next: NextFunction
): Promise<void> {
  const authHeader = req.headers.authorization;

  if (!authHeader?.startsWith('Bearer ')) {
    res.status(401).json({ error: 'Missing Authorization header' });
    return;
  }

  const token = authHeader.slice(7).trim();
  if (!token) {
    res.status(401).json({ error: 'Empty worker token' });
    return;
  }

  try {
    const user = await prisma.user.findUnique({
      where: { workerToken: token },
      select: { id: true, email: true },
    });

    if (!user) {
      res.status(401).json({ error: 'Invalid worker token' });
      return;
    }

    req.userId = user.id;
    req.userEmail = user.email;

    const machineName = (req.headers['x-machine-name'] as string) || 'Unknown Machine';
    const platform   = (req.headers['x-platform'] as string)      || 'unknown';
    const workerVersion = (req.headers['x-worker-version'] as string) || '0.0.0';

    // Upsert worker session
    const existing = await prisma.workerSession.findFirst({
      where: { userId: user.id, machineName, platform, status: 'online' },
    });

    if (existing) {
      await prisma.workerSession.update({
        where: { id: existing.id },
        data: { lastPing: new Date(), workerVersion },
      });
      req.workerSessionId = existing.id;
    } else {
      const created = await prisma.workerSession.create({
        data: { userId: user.id, machineName, platform, workerVersion, status: 'online' },
      });
      req.workerSessionId = created.id;
    }

    next();
  } catch (err) {
    console.error('[workerAuth]', err);
    res.status(500).json({ error: 'Authentication error' });
  }
}
