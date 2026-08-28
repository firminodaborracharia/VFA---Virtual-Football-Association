import { cookies } from 'next/headers';

import { isLocale, LOCALE_COOKIE } from '@/lib/i18n';

export const dynamic = 'force-dynamic';

/**
 * POST /api/locale — grava o idioma escolhido.
 *
 * Poderia ser um `document.cookie` de duas linhas no navegador. Não é, por
 * dois motivos:
 *
 *  • O valor é VALIDADO aqui. O cookie chega em toda requisição e alimenta a
 *    escolha do dicionário; aceitar qualquer texto que o cliente mandar é
 *    aceitar entrada não confiável num caminho que o servidor percorre sempre.
 *    `isLocale` fecha isso numa lista de três valores.
 *  • Os atributos do cookie ficam num lugar só, definidos pelo servidor —
 *    inclusive o `secure` em produção, que não faz sentido em localhost.
 *
 * A rota é pública de propósito: trocar de idioma não exige estar logado.
 */
export async function POST(request: Request) {
  const body = await request.json().catch(() => null);
  const locale = (body as { locale?: unknown } | null)?.locale;

  if (!isLocale(locale)) {
    return Response.json({ ok: false, error: 'Idioma inválido.' }, { status: 400 });
  }

  const store = await cookies();
  store.set(LOCALE_COOKIE, locale, {
    path: '/',
    maxAge: 60 * 60 * 24 * 365,
    sameSite: 'lax',
    // Sem `httpOnly`: nada aqui é sensível, e deixar legível permite que o
    // próprio navegador reaproveite a preferência sem uma ida ao servidor.
    secure: process.env.NODE_ENV === 'production',
  });

  return Response.json({ ok: true, data: { locale } });
}
