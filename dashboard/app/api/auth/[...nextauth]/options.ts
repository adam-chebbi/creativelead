import type { NextAuthOptions } from 'next-auth';
import CredentialsProvider from 'next-auth/providers/credentials';
import GoogleProvider from 'next-auth/providers/google';
import GitHubProvider from 'next-auth/providers/github';
import bcrypt from 'bcryptjs';
import crypto from 'crypto';
import { PrismaClient } from '@prisma/client';
import jwt from 'jsonwebtoken';

const prisma = new PrismaClient();

export const authOptions: NextAuthOptions = {
  session: { strategy: 'jwt' },
  pages: { signIn: '/auth/login' },
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
        const valid = await bcrypt.compare(credentials.password, user.passwordHash);
        if (!valid) return null;
        return { id: user.id, email: user.email, name: user.name ?? user.email };
      },
    }),
    GoogleProvider({
      clientId:     process.env.GOOGLE_CLIENT_ID!,
      clientSecret: process.env.GOOGLE_CLIENT_SECRET!,
    }),
    GitHubProvider({
      clientId:     process.env.GITHUB_CLIENT_ID!,
      clientSecret: process.env.GITHUB_CLIENT_SECRET!,
    }),
  ],
  callbacks: {
    async signIn({ user, account }) {
      // OAuth sign-in: upsert user with workerToken
      if (account && account.provider !== 'credentials') {
        const existing = await prisma.user.findUnique({ where: { email: user.email! } });
        if (!existing) {
          await prisma.user.create({
            data: {
              email:       user.email!,
              name:        user.name,
              avatarUrl:   user.image,
              workerToken: crypto.randomBytes(32).toString('hex'),
            },
          });
        }
      }
      return true;
    },
    async jwt({ token, user }) {
      if (user) {
        token.sub   = user.id;
        token.email = user.email!;
        token.name  = user.name ?? undefined;
      }
      // Sign a token the API bridge can verify
      token.accessToken = jwt.sign(
        { sub: token.sub, email: token.email },
        process.env.NEXTAUTH_SECRET!,
        { expiresIn: '7d' }
      );
      return token;
    },
    async session({ session, token }) {
      session.user.id          = token.sub as string;
      (session as any).accessToken = token.accessToken as string;
      return session;
    },
  },
};
