import { Request, Response, NextFunction } from 'express';
import { verifyDashboardJwt } from '../lib/jwt';
import { prisma } from '../lib/prisma';

/**
 * Dashboard Authentication Middleware
 *
 * Validates the NextAuth JWT sent by the Next.js frontend.
 * Authorization: Bearer <nextauth_jwt>
 */
export async function dashboardAuth(
  req: Request,
  res: Response,
  next: NextFunction
): Promise<void> {
  let token = '';

  const authHeader = req.headers.authorization;
  if (authHeader?.startsWith('Bearer ')) {
    token = authHeader.slice(7).trim();
  } else if (req.query.token && typeof req.query.token === 'string') {
    token = req.query.token;
  }

  if (!token) {
    res.status(401).json({ error: 'Missing Authorization header or token query param' });
    return;
  }

  const payload = verifyDashboardJwt(token);

  if (!payload?.sub) {
    res.status(401).json({ error: 'Invalid or expired session token' });
    return;
  }

  try {
    const user = await prisma.user.findUnique({
      where: { id: payload.sub },
      select: { id: true, email: true },
    });

    if (!user) {
      res.status(401).json({ error: 'User not found' });
      return;
    }

    req.userId    = user.id;
    req.userEmail = user.email;
    next();
  } catch (err) {
    console.error('[dashboardAuth]', err);
    res.status(500).json({ error: 'Authentication error' });
  }
}
