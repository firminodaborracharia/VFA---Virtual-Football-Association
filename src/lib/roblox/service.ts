/**
 * Integração com a API pública do Roblox — itens 3 e 29 do escopo.
 *
 * Serviço isolado, executado SOMENTE no servidor. O frontend nunca fala com o
 * Roblox: pede ao nosso backend, que consulta, normaliza e guarda no banco.
 *
 * Sobre credenciais: os endpoints usados aqui são públicos e não exigem chave
 * de API. Não há token para vazar — mas, justamente por serem públicos, eles
 * passam pelo Cloudflare do Roblox, que costuma bloquear requisições vindas de
 * IPs de datacenter. Na prática isso significa que a integração pode funcionar
 * numa hospedagem e falhar em outra. Por isso:
 *   • toda chamada tem timeout e nunca derruba a requisição do usuário;
 *   • o resultado fica em cache no banco (TTL configurável no painel);
 *   • quando a API falha, o jogador continua cadastrado e o site esconde os
 *     campos que não temos, em vez de mostrar dado inventado.
 */

import 'server-only';

const USERS_API = 'https://users.roblox.com';
const THUMBNAILS_API = 'https://thumbnails.roblox.com';
const PROFILE_BASE = 'https://www.roblox.com/users';

const TIMEOUT_MS = 8_000;

export type RobloxProfile = {
  userId: string;
  username: string;
  displayName: string | null;
  description: string | null;
  createdAt: Date | null;
  hasVerifiedBadge: boolean | null;
  avatarUrl: string | null;
  headshotUrl: string | null;
  profileUrl: string;
};

export class RobloxUnavailableError extends Error {
  constructor(message: string) {
    super(message);
    this.name = 'RobloxUnavailableError';
  }
}

export class RobloxNotFoundError extends Error {
  constructor(username: string) {
    super(`Nenhum usuário do Roblox encontrado com o username "${username}".`);
    this.name = 'RobloxNotFoundError';
  }
}

async function request<T>(url: string, init?: RequestInit): Promise<T> {
  const controller = new AbortController();
  const timeout = setTimeout(() => controller.abort(), TIMEOUT_MS);

  try {
    const response = await fetch(url, {
      ...init,
      signal: controller.signal,
      headers: {
        Accept: 'application/json',
        'Content-Type': 'application/json',
        // Alguns endpoints devolvem 403 sem User-Agent identificável.
        'User-Agent': 'VFA-Website/1.0 (+https://github.com/)',
        ...init?.headers,
      },
      // Cache próprio no banco; não queremos o cache do Next aqui.
      cache: 'no-store',
    });

    if (response.status === 429) {
      throw new RobloxUnavailableError(
        'A API do Roblox aplicou limite de requisições (429). Tente novamente em alguns minutos.',
      );
    }

    if (response.status === 403) {
      throw new RobloxUnavailableError(
        'A API do Roblox recusou a requisição (403). Isso normalmente acontece quando o servidor está hospedado num IP de datacenter bloqueado pelo Cloudflare do Roblox.',
      );
    }

    if (!response.ok) {
      throw new RobloxUnavailableError(
        `A API do Roblox respondeu com status ${response.status}.`,
      );
    }

    return (await response.json()) as T;
  } catch (error) {
    if (error instanceof RobloxUnavailableError) throw error;
    if (error instanceof Error && error.name === 'AbortError') {
      throw new RobloxUnavailableError('A API do Roblox não respondeu a tempo.');
    }
    throw new RobloxUnavailableError(
      `Não foi possível falar com a API do Roblox: ${error instanceof Error ? error.message : 'erro desconhecido'}.`,
    );
  } finally {
    clearTimeout(timeout);
  }
}

/** Resolve um username para o ID numérico do Roblox. */
export async function resolveUserId(username: string): Promise<{ id: string; name: string; displayName: string | null; hasVerifiedBadge: boolean | null }> {
  const clean = username.trim();
  if (!clean) throw new RobloxNotFoundError(username);

  const payload = await request<{
    data?: { id: number; name: string; displayName?: string; hasVerifiedBadge?: boolean }[];
  }>(`${USERS_API}/v1/usernames/users`, {
    method: 'POST',
    body: JSON.stringify({ usernames: [clean], excludeBannedUsers: false }),
  });

  const found = payload.data?.[0];
  if (!found) throw new RobloxNotFoundError(clean);

  return {
    id: String(found.id),
    name: found.name,
    displayName: found.displayName ?? null,
    hasVerifiedBadge: found.hasVerifiedBadge ?? null,
  };
}

/** Detalhes públicos do perfil. */
async function fetchDetails(userId: string) {
  return request<{
    id: number;
    name: string;
    displayName?: string;
    description?: string;
    created?: string;
    hasVerifiedBadge?: boolean;
  }>(`${USERS_API}/v1/users/${userId}`);
}

/**
 * Imagens do avatar. Falha aqui não invalida o cadastro — o jogador fica com o
 * fallback de iniciais no lugar da foto.
 */
async function fetchImages(userId: string): Promise<{ avatarUrl: string | null; headshotUrl: string | null }> {
  const pick = (payload: { data?: { state?: string; imageUrl?: string }[] }) => {
    const entry = payload.data?.[0];
    if (!entry || entry.state !== 'Completed') return null;
    return entry.imageUrl ?? null;
  };

  const [avatar, headshot] = await Promise.allSettled([
    request<{ data?: { state?: string; imageUrl?: string }[] }>(
      `${THUMBNAILS_API}/v1/users/avatar?userIds=${userId}&size=420x420&format=Png&isCircular=false`,
    ),
    request<{ data?: { state?: string; imageUrl?: string }[] }>(
      `${THUMBNAILS_API}/v1/users/avatar-headshot?userIds=${userId}&size=420x420&format=Png&isCircular=false`,
    ),
  ]);

  return {
    avatarUrl: avatar.status === 'fulfilled' ? pick(avatar.value) : null,
    headshotUrl: headshot.status === 'fulfilled' ? pick(headshot.value) : null,
  };
}

/**
 * Busca o perfil completo a partir do username.
 * Lança `RobloxNotFoundError` (username inexistente) ou
 * `RobloxUnavailableError` (API fora do ar / bloqueada).
 */
export async function fetchProfileByUsername(username: string): Promise<RobloxProfile> {
  const resolved = await resolveUserId(username);
  return fetchProfileById(resolved.id, resolved);
}

export async function fetchProfileById(
  userId: string,
  hint?: { name: string; displayName: string | null; hasVerifiedBadge: boolean | null },
): Promise<RobloxProfile> {
  // Detalhes e imagens em paralelo; imagens são opcionais.
  const [detailsResult, images] = await Promise.all([
    fetchDetails(userId).catch((error) => {
      if (hint) return null; // já temos o básico pelo lookup de username
      throw error;
    }),
    fetchImages(userId).catch(() => ({ avatarUrl: null, headshotUrl: null })),
  ]);

  const created = detailsResult?.created ? new Date(detailsResult.created) : null;

  return {
    userId,
    username: detailsResult?.name ?? hint?.name ?? '',
    displayName: detailsResult?.displayName ?? hint?.displayName ?? null,
    description: detailsResult?.description?.trim() || null,
    createdAt: created && !Number.isNaN(created.getTime()) ? created : null,
    hasVerifiedBadge: detailsResult?.hasVerifiedBadge ?? hint?.hasVerifiedBadge ?? null,
    avatarUrl: images.avatarUrl,
    headshotUrl: images.headshotUrl,
    profileUrl: profileUrl(userId),
  };
}

export function profileUrl(userId: string | null | undefined): string {
  if (!userId) return `${PROFILE_BASE}/profile`;
  return `${PROFILE_BASE}/${userId}/profile`;
}

/** O cache do jogador venceu? */
export function isStale(syncedAt: Date | null, ttlHours: number): boolean {
  if (!syncedAt) return true;
  return Date.now() - syncedAt.getTime() > ttlHours * 60 * 60 * 1000;
}
