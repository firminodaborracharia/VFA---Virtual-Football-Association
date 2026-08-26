/**
 * Sincronização dos dados do Roblox com o banco.
 *
 * Separado de `service.ts` de propósito: aquele fala com a API, este decide
 * quando falar e o que gravar. Assim dá para testar a política de cache sem
 * bater na rede.
 */

import 'server-only';

import { eq } from 'drizzle-orm';

import { db } from '@/db';
import { players } from '@/db/schema';
import { getSetting } from '@/lib/settings';
import {
  fetchProfileByUsername,
  isStale,
  RobloxNotFoundError,
  RobloxUnavailableError,
} from './service';

export type SyncResult =
  | { status: 'UPDATED'; syncedAt: Date }
  | { status: 'CACHED'; syncedAt: Date | null }
  | { status: 'SKIPPED'; reason: string }
  | { status: 'FAILED'; reason: string };

/**
 * Atualiza os dados do Roblox de um jogador.
 *
 * @param force ignora o TTL do cache (é o que o botão "Atualizar dados Roblox"
 *              do painel usa).
 */
export async function syncPlayerRoblox(playerId: string, force = false): Promise<SyncResult> {
  const [player] = await db.select().from(players).where(eq(players.id, playerId)).limit(1);
  if (!player) return { status: 'FAILED', reason: 'Jogador não encontrado.' };

  const settings = await getSetting('roblox');

  if (!settings.enabled) {
    return { status: 'SKIPPED', reason: 'A integração com o Roblox está desligada nas configurações.' };
  }

  if (!force && !isStale(player.robloxSyncedAt, settings.cacheTtlHours)) {
    return { status: 'CACHED', syncedAt: player.robloxSyncedAt };
  }

  try {
    const profile = await fetchProfileByUsername(player.robloxUsername);
    const syncedAt = new Date();

    await db
      .update(players)
      .set({
        robloxUserId: profile.userId,
        // O Roblox permite trocar de username; mantemos o nosso registro
        // alinhado ao que a API devolve.
        robloxUsername: profile.username || player.robloxUsername,
        robloxDisplayName: profile.displayName,
        robloxAvatarUrl: profile.avatarUrl,
        robloxHeadshotUrl: profile.headshotUrl,
        robloxCreatedAt: profile.createdAt,
        robloxDescription: profile.description,
        robloxIsVerified: profile.hasVerifiedBadge,
        robloxSyncedAt: syncedAt,
        robloxSyncError: null,
      })
      .where(eq(players.id, playerId));

    return { status: 'UPDATED', syncedAt };
  } catch (error) {
    const reason =
      error instanceof RobloxNotFoundError || error instanceof RobloxUnavailableError
        ? error.message
        : 'Erro inesperado ao consultar o Roblox.';

    // O erro fica registrado para o painel mostrar, mas o cadastro do jogador
    // continua intacto — nunca apagamos dado bom por causa de uma falha de rede.
    await db
      .update(players)
      .set({ robloxSyncError: reason })
      .where(eq(players.id, playerId));

    return { status: 'FAILED', reason };
  }
}

/**
 * Sincroniza vários jogadores em série, com pausa entre chamadas.
 * Em série de propósito: disparar 40 requisições paralelas para o Roblox é o
 * caminho mais rápido para tomar 429 (item 30 — evitar requisições
 * desnecessárias à API).
 */
export async function syncManyPlayers(
  playerIds: string[],
  { force = false, delayMs = 350 }: { force?: boolean; delayMs?: number } = {},
): Promise<Record<string, SyncResult>> {
  const results: Record<string, SyncResult> = {};

  for (const [index, playerId] of playerIds.entries()) {
    results[playerId] = await syncPlayerRoblox(playerId, force);
    if (index < playerIds.length - 1) {
      await new Promise((resolve) => setTimeout(resolve, delayMs));
    }
  }

  return results;
}
