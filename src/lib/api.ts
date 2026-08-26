/**
 * Utilidades das rotas de API — itens 27 e 28 do escopo.
 *
 * Padroniza:
 *  • formato das respostas (sucesso e erro);
 *  • validação de payload com Zod, sempre no servidor;
 *  • proteção das rotas administrativas;
 *  • rate limiting;
 *  • paginação.
 */

import { ZodError, type ZodType } from 'zod';

import { apiAdmin, apiUser, type AppSession } from './rbac';

export type ApiSuccess<T> = { ok: true; data: T; meta?: Record<string, unknown> };
export type ApiFailure = { ok: false; error: string; details?: unknown };

export function ok<T>(data: T, meta?: Record<string, unknown>, init?: ResponseInit) {
  return Response.json({ ok: true, data, meta } satisfies ApiSuccess<T>, init);
}

export function fail(error: string, status = 400, details?: unknown) {
  return Response.json({ ok: false, error, details } satisfies ApiFailure, { status });
}

export const unauthorizedResponse = () =>
  fail('Você precisa entrar com o Discord para fazer isso.', 401);

export const forbiddenResponse = () =>
  fail('Esta ação é restrita a administradores da VFA.', 403);

export const notFoundResponse = (what = 'Registro') => fail(`${what} não encontrado.`, 404);

/* ── Rate limiting ────────────────────────────────────────────
   Janela deslizante em memória. Suficiente para uma instância e para o volume
   da VFA; num deploy com várias instâncias cada uma tem o seu contador, então
   o limite efetivo é `limit × instâncias`. Se isso passar a importar, troque o
   Map por Redis mantendo esta mesma assinatura.                          */

type Bucket = { count: number; resetAt: number };
const buckets = new Map<string, Bucket>();

export function rateLimit(key: string, limit = 30, windowMs = 60_000): boolean {
  const now = Date.now();
  const bucket = buckets.get(key);

  if (!bucket || bucket.resetAt <= now) {
    buckets.set(key, { count: 1, resetAt: now + windowMs });
    return true;
  }

  if (bucket.count >= limit) return false;
  bucket.count += 1;
  return true;

}

/** Limpeza periódica para o Map não crescer sem limite. */
if (typeof setInterval !== 'undefined') {
  const timer = setInterval(() => {
    const now = Date.now();
    for (const [key, bucket] of buckets) {
      if (bucket.resetAt <= now) buckets.delete(key);
    }
  }, 60_000);
  // Não segura o processo aberto em ambientes de execução curta.
  timer.unref?.();
}

export function clientKey(request: Request, prefix = ''): string {
  const forwarded = request.headers.get('x-forwarded-for');
  const ip = forwarded?.split(',')[0]?.trim() || request.headers.get('x-real-ip') || 'desconhecido';
  return `${prefix}:${ip}`;
}

/* ── Validação ────────────────────────────────────────────── */

export class ApiError extends Error {
  /**
   * Marcador explícito em vez de `instanceof`.
   *
   * O bundler do Next pode carregar este módulo em mais de um chunk do servidor;
   * quando isso acontece existem duas classes `ApiError` distintas e o
   * `instanceof` falha silenciosamente — o resultado é uma recusa legítima
   * ("este é o último administrador") virando um 500 genérico. Uma propriedade
   * de marcação atravessa qualquer fronteira de módulo.
   */
  readonly isApiError = true as const;

  constructor(
    message: string,
    readonly status = 400,
    readonly details?: unknown,
  ) {
    super(message);
    this.name = 'ApiError';
  }
}

function isApiError(error: unknown): error is ApiError {
  return (
    typeof error === 'object' &&
    error !== null &&
    (error as { isApiError?: boolean }).isApiError === true
  );
}

/** Lê e valida o corpo JSON. Lança `ApiError` legível em caso de problema. */
export async function readBody<T>(request: Request, schema: ZodType<T>): Promise<T> {
  let raw: unknown;
  try {
    raw = await request.json();
  } catch {
    throw new ApiError('Corpo da requisição não é um JSON válido.', 400);
  }

  const parsed = schema.safeParse(raw);
  if (!parsed.success) {
    throw new ApiError('Dados inválidos.', 422, formatZodIssues(parsed.error));
  }
  return parsed.data;
}

export function formatZodIssues(error: ZodError): Record<string, string> {
  const out: Record<string, string> = {};
  for (const issue of error.issues) {
    const path = issue.path.join('.') || '_';
    out[path] ??= issue.message;
  }
  return out;
}

/* ── Wrappers de rota ─────────────────────────────────────── */

/**
 * O contexto que o Next entrega a um Route Handler.
 *
 * O segundo parâmetro do handler exportado é declarado como `unknown` de
 * propósito: assim o mesmo wrapper serve tanto para rotas estáticas
 * (`/api/search`) quanto para dinâmicas (`/api/players/[id]`), sem brigar com
 * os tipos que o Next gera para cada rota.
 */
export type RouteParams = { params: Promise<Record<string, string>> };

type Handler = (request: Request, context: RouteParams) => Promise<Response>;
type AdminHandler = (
  request: Request,
  context: RouteParams & { session: AppSession },
) => Promise<Response>;

type ExportedHandler = (request: Request, context?: unknown) => Promise<Response>;

const emptyContext = (): RouteParams => ({ params: Promise.resolve({}) });

/** Envolve um handler público com tratamento de erro uniforme. */
export function route(handler: Handler): ExportedHandler {
  return async (request, context) => {
    try {
      return await handler(request, (context as RouteParams | undefined) ?? emptyContext());
    } catch (error) {
      return toErrorResponse(error);
    }
  };
}

/** Envolve um handler administrativo: exige ADMIN e aplica rate limiting. */
export function adminRoute(handler: AdminHandler): ExportedHandler {
  return async (request, context) => {
    try {
      const session = await apiAdmin();
      if (!session) {
        const user = await apiUser();
        return user ? forbiddenResponse() : unauthorizedResponse();
      }

      if (!rateLimit(`admin:${session.user.id}`, 120, 60_000)) {
        return fail('Muitas requisições. Aguarde um instante.', 429);
      }

      const base = (context as RouteParams | undefined) ?? emptyContext();
      return await handler(request, { ...base, session });
    } catch (error) {
      return toErrorResponse(error);
    }
  };
}

export function toErrorResponse(error: unknown): Response {
  if (isApiError(error)) {
    return fail(error.message, error.status, error.details);
  }

  if (error instanceof ZodError) {
    return fail('Dados inválidos.', 422, formatZodIssues(error));
  }

  // Violação de unicidade do PostgreSQL.
  if (typeof error === 'object' && error !== null && 'code' in error) {
    const code = (error as { code?: string }).code;
    if (code === '23505') {
      return fail('Já existe um registro com esses dados (valor duplicado).', 409);
    }
    if (code === '23503') {
      return fail('Não é possível concluir: existe outro registro dependendo deste.', 409);
    }
  }

  console.error('[VFA] Erro não tratado na API:', error);
  return fail('Erro interno. Tente novamente em instantes.', 500);
}

/* ── Paginação ────────────────────────────────────────────── */

export type Pagination = { page: number; perPage: number; offset: number };

export function readPagination(request: Request, defaultPerPage = 24, maxPerPage = 100): Pagination {
  const url = new URL(request.url);
  const page = Math.max(1, Number(url.searchParams.get('page') ?? 1) || 1);
  const perPage = Math.min(
    maxPerPage,
    Math.max(1, Number(url.searchParams.get('perPage') ?? defaultPerPage) || defaultPerPage),
  );
  return { page, perPage, offset: (page - 1) * perPage };
}

export function paginationMeta(pagination: Pagination, total: number) {
  return {
    page: pagination.page,
    perPage: pagination.perPage,
    total,
    totalPages: Math.max(1, Math.ceil(total / pagination.perPage)),
  };
}
