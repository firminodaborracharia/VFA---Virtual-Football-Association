import { NextResponse, type NextRequest } from 'next/server';

/**
 * Primeira barreira das rotas administrativas.
 *
 * Aqui não dá para validar a sessão de verdade: ela vive no banco e o proxy
 * roda antes da aplicação, sem acesso a ele. O que este arquivo faz é barrar
 * quem chega em /admin sem nenhum cookie de sessão — o caso mais comum — sem
 * gastar uma renderização.
 *
 * A autorização REAL acontece em três lugares independentes:
 *   1. `requireAdmin()` no topo de cada página de /admin, antes de qualquer
 *      consulta ao banco;
 *   2. `requireAdmin()` no layout de /admin;
 *   3. `adminRoute()` em toda rota de API administrativa.
 *
 * Nenhuma dessas camadas confia nas outras.
 */
const SESSION_COOKIES = [
  'authjs.session-token',
  '__Secure-authjs.session-token',
];

export function proxy(request: NextRequest) {
  const hasSessionCookie = SESSION_COOKIES.some((name) => request.cookies.has(name));

  if (!hasSessionCookie) {
    const url = new URL('/entrar', request.url);
    url.searchParams.set('next', request.nextUrl.pathname);
    return NextResponse.redirect(url);
  }

  return NextResponse.next();
}

export const config = {
  matcher: ['/admin/:path*'],
};
