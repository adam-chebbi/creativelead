import type { NextAuthOptions } from 'next-auth';
import CredentialsProvider from 'next-auth/providers/credentials';
import GoogleProvider from 'next-auth/providers/google';
import GitHubProvider from 'next-auth/providers/github';
import { PrismaAdapter } from '@auth/prisma-adapter';
import bcrypt from 'bcryptjs';
import crypto from 'crypto';
import { prisma } from '@/lib/prisma';
import jwt from 'jsonwebtoken';
import { UserRole } from '@prisma/client';

const APP_URL = process.env.NEXTAUTH_URL || 'http://localhost:3000';

export const authOptions: NextAuthOptions = {
  adapter: PrismaAdapter(prisma) as any,
  session: { strategy: 'jwt' },
  pages: { signIn: '/login' },
  providers: [
    CredentialsProvider({
      name: 'credentials',
      credentials: {
        email:    { label: 'Email',    type: 'email' },
        password: { label: 'Password', type: 'password' },
      },
      async authorize(credentials) {
        if (!credentials?.email || !credentials?.password) return null;
        const user = await prisma.user.findUnique({ where: { email: credentials.email } });
        if (!user || !user.passwordHash) return null;
        if (user.suspended) return null; // block suspended users
        const valid = await bcrypt.compare(credentials.password, user.passwordHash);
        if (!valid) return null;
        return {
          id: user.id,
          email: user.email,
          name: user.name ?? user.email,
          role: user.role,
          suspended: user.suspended,
        };
      },
    }),
    GoogleProvider({
      clientId:     process.env.GOOGLE_CLIENT_ID  ?? '',
      clientSecret: process.env.GOOGLE_CLIENT_SECRET ?? '',
    }),
    GitHubProvider({
      clientId:     process.env.GITHUB_CLIENT_ID  ?? '',
      clientSecret: process.env.GITHUB_CLIENT_SECRET ?? '',
    }),
  ],
  callbacks: {
    async signIn({ user, account }) {
      // Block suspended users from OAuth sign-in
      if (user?.id) {
        const dbUser = await prisma.user.findUnique({ where: { id: user.id } });
        if (dbUser?.suspended) return false;
        // Update lastActiveAt on every sign-in
        await prisma.user.update({
          where: { id: user.id },
          data: { lastActiveAt: new Date() },
        }).catch(() => {});
      }
      return true;
    },

    async jwt({ token, user, trigger, session: updateSession }) {
      if (user) {
        token.sub       = user.id;
        token.email     = user.email!;
        token.name      = user.name ?? undefined;
        token.role      = (user as any).role ?? UserRole.USER;
        token.suspended = (user as any).suspended ?? false;
      }

      // Refresh role from DB on every token refresh (ensures role changes take effect)
      if (token.sub && !user) {
        const dbUser = await prisma.user.findUnique({
          where: { id: token.sub },
          select: { role: true, suspended: true },
        });
        if (dbUser) {
          token.role      = dbUser.role;
          token.suspended = dbUser.suspended;
        }
      }

      // Handle impersonation session update
      if (trigger === 'update' && updateSession?.isImpersonating !== undefined) {
        token.isImpersonating = updateSession.isImpersonating;
        token.impersonatedBy  = updateSession.impersonatedBy;
        if (updateSession.impersonateUserId) {
          // Switch token to target user's identity
          const targetUser = await prisma.user.findUnique({
            where: { id: updateSession.impersonateUserId },
            select: { id: true, email: true, name: true, role: true, suspended: true },
          });
          if (targetUser) {
            token.sub       = targetUser.id;
            token.email     = targetUser.email!;
            token.name      = targetUser.name ?? undefined;
            token.role      = targetUser.role;
            token.suspended = targetUser.suspended;
          }
        }
      }

      // Only sign once — reuse on subsequent refreshes to avoid token churn
      if (!token.accessToken) {
        token.accessToken = jwt.sign(
          { sub: token.sub, email: token.email },
          process.env.NEXTAUTH_SECRET!,
          { expiresIn: '7d' }
        );
      }
      return token;
    },

    async session({ session, token }) {
      if (session.user && token.sub) {
        session.user.id        = token.sub as string;
        session.user.role      = (token.role as UserRole) ?? UserRole.USER;
        session.user.suspended = (token.suspended as boolean) ?? false;
      }
      (session as any).accessToken    = token.accessToken as string;
      (session as any).isImpersonating = token.isImpersonating ?? false;
      (session as any).impersonatedBy  = token.impersonatedBy ?? null;
      return session;
    },
  },
};
