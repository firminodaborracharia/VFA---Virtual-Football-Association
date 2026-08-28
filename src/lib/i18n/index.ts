import { cookies, headers } from 'next/headers';
import { cache } from 'react';

import {
  DEFAULT_LOCALE,
  DICTIONARIES,
  LOCALES,
  type Dictionary,
  type Locale,
} from './dictionaries';

export * from './dictionaries';

export const LOCALE_COOKIE = 'vfa-locale';

export function isLocale(value: unknown): value is Locale {
  return typeof value === 'string' && (LOCALES as readonly string[]).includes(value);
}

/**
 * Descobre o idioma da visita.
 *
 * A ordem importa e é deliberada:
 *
 *  1. O cookie, se existir. Escolha explícita de quem está navegando ganha de
 *     qualquer palpite do sistema.
 *  2. O cabeçalho `Accept-Language` do navegador. Um espanhol que cai no site
 *     pela primeira vez já vê espanhol, sem precisar procurar o botão.
 *  3. Português.
 *
 * `cache()` do React garante uma leitura por requisição, e não uma por
 * componente que precisar do idioma.
 */
export const getLocale = cache(async (): Promise<Locale> => {
  const store = await cookies();
  const saved = store.get(LOCALE_COOKIE)?.value;
  if (isLocale(saved)) return saved;

  try {
    const accept = (await headers()).get('accept-language');
    const detected = negotiate(accept);
    if (detected) return detected;
  } catch {
    // Contextos sem cabeçalhos (geração estática): cai no padrão.
  }

  return DEFAULT_LOCALE;
});

/**
 * Lê o `Accept-Language` respeitando os pesos `q`.
 *
 * O cabeçalho vem como `es-AR,es;q=0.9,en;q=0.8`: uma lista em ordem de
 * preferência. Pegar só o primeiro item daria certo na maioria das vezes e
 * erraria justamente em quem tem vários idiomas configurados.
 */
function negotiate(accept: string | null): Locale | null {
  if (!accept) return null;

  const ranked = accept
    .split(',')
    .map((part) => {
      const [tag, ...params] = part.trim().split(';');
      const quality = params
        .map((param) => param.trim())
        .find((param) => param.startsWith('q='));
      return {
        // `es-AR` e `es` devem cair ambos em espanhol.
        base: tag.trim().toLowerCase().split('-')[0],
        quality: quality ? Number(quality.slice(2)) || 0 : 1,
      };
    })
    .sort((a, b) => b.quality - a.quality);

  for (const entry of ranked) {
    if (isLocale(entry.base)) return entry.base;
  }

  return null;
}

/** Dicionário da requisição atual. */
export const getDictionary = cache(async (): Promise<Dictionary> => {
  return DICTIONARIES[await getLocale()];
});

/** Dicionário de um idioma específico, para componentes que já o receberam. */
export function dictionaryFor(locale: Locale): Dictionary {
  return DICTIONARIES[locale];
}
