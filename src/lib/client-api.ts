'use client';

/**
 * Cliente das rotas administrativas.
 *
 * Centraliza o `fetch` para que toda tela do painel trate erro do mesmo jeito:
 * mensagem legível vinda do backend, e nunca um "[object Object]" na tela.
 */

export type ApiResult<T> =
  | { ok: true; data: T; meta?: Record<string, unknown> }
  | { ok: false; error: string; details?: Record<string, string> };

async function request<T>(
  method: string,
  url: string,
  body?: unknown,
): Promise<ApiResult<T>> {
  try {
    const response = await fetch(url, {
      method,
      headers: body ? { 'Content-Type': 'application/json' } : undefined,
      body: body ? JSON.stringify(body) : undefined,
    });

    const payload = await response.json().catch(() => null);

    if (!response.ok || !payload?.ok) {
      return {
        ok: false,
        error: payload?.error ?? `Erro ${response.status} ao falar com o servidor.`,
        details: payload?.details as Record<string, string> | undefined,
      };
    }

    return { ok: true, data: payload.data as T, meta: payload.meta };
  } catch {
    return {
      ok: false,
      error: 'Não foi possível falar com o servidor. Verifique a sua conexão.',
    };
  }
}

export const api = {
  get: <T>(url: string) => request<T>('GET', url),
  post: <T>(url: string, body?: unknown) => request<T>('POST', url, body),
  patch: <T>(url: string, body?: unknown) => request<T>('PATCH', url, body),
  put: <T>(url: string, body?: unknown) => request<T>('PUT', url, body),
  del: <T>(url: string) => request<T>('DELETE', url),
};

/** Converte um Date para o formato aceito por `<input type="datetime-local">`. */
export function toLocalInput(date: Date | string | null | undefined): string {
  if (!date) return '';
  const value = typeof date === 'string' ? new Date(date) : date;
  if (Number.isNaN(value.getTime())) return '';
  const offset = value.getTimezoneOffset() * 60_000;
  return new Date(value.getTime() - offset).toISOString().slice(0, 16);
}

/** Converte o valor de um `datetime-local` para ISO com fuso. */
export function fromLocalInput(value: string): string | null {
  if (!value) return null;
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return null;
  return date.toISOString();
}
