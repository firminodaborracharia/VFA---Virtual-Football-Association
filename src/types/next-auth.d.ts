import type { DefaultSession } from 'next-auth';

declare module 'next-auth' {
  interface Session {
    user: {
      id: string;
      role: 'USER' | 'ADMIN';
      isBanned: boolean;
      discordUsername: string | null;
    } & DefaultSession['user'];
  }

  interface User {
    role?: 'USER' | 'ADMIN';
    isBanned?: boolean;
    discordUsername?: string | null;
  }
}

export {};
