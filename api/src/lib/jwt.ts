import jwt from 'jsonwebtoken';

const JWT_SECRET = process.env.JWT_SECRET || 'dev-secret-change-in-production';

export interface DashboardJwtPayload {
  sub: string;
  email: string;
  name?: string;
  iat?: number;
  exp?: number;
}

/**
 * Verify a NextAuth JWT from the dashboard.
 * NextAuth signs tokens with NEXTAUTH_SECRET — we share that value
 * as JWT_SECRET in the API server environment.
 */
export function verifyDashboardJwt(token: string): DashboardJwtPayload | null {
  try {
    return jwt.verify(token, JWT_SECRET) as DashboardJwtPayload;
  } catch {
    return null;
  }
}
