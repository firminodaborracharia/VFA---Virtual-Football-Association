/**
 * Sanitização do HTML das notícias.
 *
 * Rodada SEMPRE no servidor, antes de gravar no banco (e de novo na leitura,
 * como cinto e suspensório). Sem isto, o editor rico do painel administrativo
 * seria um vetor de XSS armazenado direto na home do site.
 */

import sanitizeHtml from 'sanitize-html';

const OPTIONS: sanitizeHtml.IOptions = {
  allowedTags: [
    'h2',
    'h3',
    'h4',
    'p',
    'blockquote',
    'ul',
    'ol',
    'li',
    'strong',
    'em',
    'u',
    's',
    'a',
    'img',
    'figure',
    'figcaption',
    'hr',
    'br',
    'code',
    'pre',
    'table',
    'thead',
    'tbody',
    'tr',
    'th',
    'td',
  ],
  allowedAttributes: {
    a: ['href', 'title', 'target', 'rel'],
    img: ['src', 'alt', 'title', 'width', 'height', 'loading'],
    '*': ['class'],
  },
  // Apenas esquemas seguros. Bloqueia javascript:, data: e vbscript:.
  allowedSchemes: ['http', 'https', 'mailto'],
  allowedSchemesByTag: { img: ['http', 'https'] },
  transformTags: {
    // Todo link externo abre em nova aba sem vazar o referrer nem dar
    // acesso a window.opener.
    a: (tagName, attribs) => ({
      tagName,
      attribs: { ...attribs, target: '_blank', rel: 'noopener noreferrer nofollow' },
    }),
    img: (tagName, attribs) => ({
      tagName,
      attribs: { ...attribs, loading: 'lazy' },
    }),
  },
  disallowedTagsMode: 'discard',
};

export function sanitizeNewsHtml(dirty: string): string {
  return sanitizeHtml(dirty, OPTIONS);
}

/** Texto puro, para gerar resumo automático e alimentar a busca. */
export function htmlToPlainText(html: string): string {
  return sanitizeHtml(html, { allowedTags: [], allowedAttributes: {} })
    .replace(/\s+/g, ' ')
    .trim();
}

/** Resumo automático quando o administrador não escreve um. */
export function buildExcerpt(html: string, maxLength = 180): string {
  const text = htmlToPlainText(html);
  if (text.length <= maxLength) return text;
  return `${text.slice(0, maxLength).replace(/\s+\S*$/, '')}…`;
}
