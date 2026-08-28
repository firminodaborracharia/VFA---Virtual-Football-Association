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
import { cache } from 'react';

import { auth } from '@/auth';
import { withTimeout } from '@/db';

export type AppSession = Session & {
  user: NonNullable<Session['user']>;
};

/**
 * Lê a sessão sem lançar e sem pendurar.
 *
 * Três garantias, nesta ordem:
 *
 * 1. Não lança. Uma falha aqui (`AUTH_SECRET` ausente, banco indisponível,
 *    cookie corrompido) vira "ninguém logado", não uma página quebrada.
 * 2. Não pendura. A sessão fica em banco (`strategy: 'database'`), então ler
 *    a sessão é uma consulta de rede. Sem teto de tempo, um banco lento
 *    congelava toda página do site — inclusive as públicas, que nem precisam
 *    de sessão.
 * 3. Não repete. `cache()` faz o layout, a página e cada guarda de rota
 *    dividirem a mesma leitura dentro de uma requisição.
 *
 * Os dois primeiros itens são seguros porque falham FECHADO: sem sessão,
 * `requireAdmin` redireciona e `apiAdmin` devolve 401. O risco seria o
 * contrário — tratar erro como "autorizado".
 */
const readSession = cache(async (): Promise<Session | null> => {
  try {
    return await withTimeout(auth(), null, {
      ms: 8_000,
      label: 'Leitura da sessão',
    });
  } catch (error) {
    console.error(
      '[VFA] Falha ao ler a sessão — tratando como visitante deslogado.',
      error instanceof Error ? `${error.name}: ${error.message}` : error,
    );
    return null;
  }
});

export async function getSession(): Promise<Session | null> {
  return readSession();
}

export function isAdmin(session: Session | null | undefined): boolean {
  return session?.user?.role === 'ADMIN' && !session.user.isBanned;
}

export async function currentUser() {
  const session = await readSession();
  if (!session?.user || session.user.isBanned) return null;
  return session.user;
}

/**
 * Para Server Components: exige usuário logado.
 * Usa `redirect()` em vez das APIs experimentais `unauthorized()`/`forbidden()`
 * para não depender da flag `experimental.authInterrupts` no núcleo da auth.
 */
export async function requireUser(redirectTo = '/'): Promise<AppSession> {
  const session = await readSession();
  if (!session?.user || session.user.isBanned) {
    redirect(`/entrar?next=${encodeURIComponent(redirectTo)}`);
  }
  return session as AppSession;
}

/** Para Server Components: exige administrador. */
export async function requireAdmin(redirectTo = '/admin'): Promise<AppSession> {
  const session = await readSession();
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
  const session = await readSession();
  if (!session?.user || session.user.isBanned) return null;
  return session as AppSession;
}

export async function apiAdmin(): Promise<AppSession | null> {
  const session = await readSession();
  if (!session?.user || session.user.isBanned) return null;
  if (session.user.role !== 'ADMIN') return null;
  return session as AppSession;
}
