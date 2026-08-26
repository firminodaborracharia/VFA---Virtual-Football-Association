/**
 * Autenticação — item 2 do escopo.
 *
 * Login exclusivamente via Discord OAuth2. Não existe cadastro com e-mail e
 * senha, nem formulário: o usuário autoriza no Discord e o perfil é criado
 * automaticamente na primeira entrada.
 *
 * Sessão em banco (`strategy: 'database'`), e não em JWT: assim, banir ou
 * rebaixar um usuário tem efeito imediato na próxima requisição, em vez de
 * esperar o token expirar. O papel (`role`) NUNCA vem do cliente — é sempre
 * lido do banco no callback de sessão.
 */

import { DrizzleAdapter } from '@auth/drizzle-adapter';
import { eq } from 'drizzle-orm';
import NextAuth from 'next-auth';
import Discord from 'next-auth/providers/discord';

import { db } from '@/db';
import { accounts, sessions, users, verificationTokens } from '@/db/schema';

/** Perfil público devolvido pela API do Discord. */
type DiscordProfile = {
  id?: string;
  username?: string;
  global_name?: string | null;
  avatar?: string | null;
};

function bootstrapAdminIds(): string[] {
  return (process.env.BOOTSTRAP_ADMIN_DISCORD_IDS ?? '')
    .split(',')
    .map((value) => value.trim())
    .filter(Boolean);
}

/** O login do Discord está configurado? Usado para dar mensagem clara na UI. */
export function isDiscordConfigured(): boolean {
  return Boolean(process.env.AUTH_DISCORD_ID && process.env.AUTH_DISCORD_SECRET);
}

/**
 * Espelha os dados do Discord no perfil e aplica a promoção automática de
 * administrador. Roda a cada login, então trocar o nome no Discord reflete
 * no site sem intervenção manual.
 */
async function syncDiscordProfile(
  userId: string,
  providerAccountId: string | undefined,
  profile: DiscordProfile | undefined,
) {
  const discordId = profile?.id ?? providerAccountId;
  if (!discordId) return;

  const shouldBeAdmin = bootstrapAdminIds().includes(discordId);

  const patch: Record<string, unknown> = {
    discordId,
    discordUsername: profile?.username ?? null,
    discordGlobalName: profile?.global_name ?? null,
  };

  // A promoção via variável de ambiente só ADICIONA privilégio. Ela nunca
  // rebaixa alguém — quem tirou o ID da lista não perde o acesso sem passar
  // pelo painel, e isso evita perder o último admin por engano.
  if (shouldBeAdmin) patch.role = 'ADMIN';

  await db.update(users).set(patch).where(eq(users.id, userId));
}

export const { handlers, auth, signIn, signOut } = NextAuth({
  adapter: DrizzleAdapter(db, {
    usersTable: users,
    accountsTable: accounts,
    sessionsTable: sessions,
    verificationTokensTable: verificationTokens,
  }),

  session: { strategy: 'database', maxAge: 30 * 24 * 60 * 60 },

  providers: [
    Discord({
      clientId: process.env.AUTH_DISCORD_ID ?? '',
      clientSecret: process.env.AUTH_DISCORD_SECRET ?? '',
      // `identify` dá username, global_name e avatar. Não pedimos e-mail nem
      // lista de servidores: o site não precisa e escopo a mais é risco a mais.
      authorization: { params: { scope: 'identify' } },
    }),
  ],

  pages: {
    signIn: '/entrar',
    error: '/entrar',
  },

  callbacks: {
    /** Barra o login de quem está banido, antes de criar sessão. */
    async signIn({ user }) {
      if (!user?.id) return true; // primeiro login: ainda não existe no banco
      const [existing] = await db
        .select({ isBanned: users.isBanned })
        .from(users)
        .where(eq(users.id, user.id))
        .limit(1);
      return !existing?.isBanned;
    },

    /**
     * Enriquece a sessão com o papel lido do banco. É a única fonte de verdade
     * de permissão usada pelo servidor.
     */
    async session({ session, user }) {
      if (session.user) {
        session.user.id = user.id;
        session.user.role = (user as { role?: 'USER' | 'ADMIN' }).role ?? 'USER';
        session.user.isBanned = (user as { isBanned?: boolean }).isBanned ?? false;
        session.user.discordUsername =
          (user as { discordUsername?: string | null }).discordUsername ?? null;
      }
      return session;
    },
  },

  events: {
    async signIn({ user, account, profile }) {
      if (!user?.id) return;
      await syncDiscordProfile(
        user.id,
        account?.providerAccountId,
        profile as DiscordProfile | undefined,
      );
    },
  },

  trustHost: true,
});
