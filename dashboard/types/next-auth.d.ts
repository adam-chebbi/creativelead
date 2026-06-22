import { UserRole } from '@prisma/client';
import 'next-auth';
import 'next-auth/jwt';

declare module 'next-auth' {
  interface Session {
    user: {
      id: string;
      name?: string | null;
      email?: string | null;
      image?: string | null;
      role: UserRole;
      suspended: boolean;
    };
    accessToken?: string;
    isImpersonating?: boolean;
    impersonatedBy?: string;
  }

  interface User {
    id: string;
    role?: UserRole;
    suspended?: boolean;
  }
}

declare module 'next-auth/jwt' {
  interface JWT {
    sub: string;
    email: string;
    name?: string;
    role?: UserRole;
    suspended?: boolean;
    accessToken?: string;
    isImpersonating?: boolean;
    impersonatedBy?: string;
  }
}
