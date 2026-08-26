/**
 * Autorização — item 27 do escopo.
 *
 * Regra inegociável: permissão nunca vem do frontend. Toda checagem lê o papel
 * da sessão, que por sua vez é lido do banco a cada requisição. Esconder um
 * botão no menu é conveniência visual, não segurança — quem chamar a rota
 * direto no `fetch` continua barrado aqui.
 */

import { redirect } from 'next/navigation';
import type { Session } from 'next-auth';

import { auth } from '@/auth';

export type AppSession = Session & {
  user: NonNullable<Session['user']>;
};

export async function getSession(): Promise<Session | null> {
  return auth();
}

export function isAdmin(session: Session | null | undefined): boolean {
  return session?.user?.role === 'ADMIN' && !session.user.isBanned;
}

export async function currentUser() {
  const session = await auth();
  if (!session?.user || session.user.isBanned) return null;
  return session.user;
}

/**
 * Para Server Components: exige usuário logado.
 * Usa `redirect()` em vez das APIs experimentais `unauthorized()`/`forbidden()`
 * para não depender da flag `experimental.authInterrupts` no núcleo da auth.
 */
export async function requireUser(redirectTo = '/'): Promise<AppSession> {
  const session = await auth();
  if (!session?.user || session.user.isBanned) {
    redirect(`/entrar?next=${encodeURIComponent(redirectTo)}`);
  }
  return session as AppSession;
}

/** Para Server Components: exige administrador. */
export async function requireAdmin(redirectTo = '/admin'): Promise<AppSession> {
  const session = await auth();
  if (!session?.user || session.user.isBanned) {
    redirect(`/entrar?next=${encodeURIComponent(redirectTo)}`);
  }
  if (session.user.role !== 'ADMIN') {
    redirect('/sem-permissao');
  }
  return session as AppSession;
}

/* ── Versões para Route Handlers ──────────────────────────────
   Em rotas de API devolvemos `null` em vez de disparar a UI de erro, para que
   o handler responda JSON com o status certo.                            */

export async function apiUser(): Promise<AppSession | null> {
  const session = await auth();
  if (!session?.user || session.user.isBanned) return null;
  return session as AppSession;
}

export async function apiAdmin(): Promise<AppSession | null> {
  const session = await auth();
  if (!session?.user || session.user.isBanned) return null;
  if (session.user.role !== 'ADMIN') return null;
  return session as AppSession;
}
