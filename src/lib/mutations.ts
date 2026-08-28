/**
 * Escrita no banco.
 *
 * As rotas de API são finas: validam o payload e chamam uma função daqui.
 * Isso mantém as regras de negócio num lugar só e permite que o seed e o
 * painel usem exatamente o mesmo caminho — nada de lógica duplicada que
 * diverge com o tempo.
 *
 * Toda ação administrativa grava uma linha em `audit_logs`.
 */

import { and, eq, ne, sql } from 'drizzle-orm';

import { ApiError } from '@/lib/api';
import { db } from '@/db';
import {
  auditLogs,
  clubSeasonMemberships,
  clubs,
  competitionTeams,
  competitions,
  matchAppearances,
  matchEvents,
  matches,
  news,
  players,
  qualificationZones,
  seasons,
  transfers,
  users,
} from '@/db/schema';
import { advanceBracket } from '@/lib/engine/generate';
import { recomputeCompetition, recomputeSeason, resolveChampion } from '@/lib/engine/recompute';
import { syncPlayerRoblox } from '@/lib/roblox/sync';
import { buildExcerpt, sanitizeNewsHtml } from '@/lib/sanitize';
import { slugify } from '@/lib/utils';
import type {
  ClubCreateInput,
  CompetitionInput,
  MatchCreateInput,
  MatchResultInput,
  NewsInput,
  PlayerCreateInput,
  PlayerUpdateInput,
  TransferInput,
} from '@/lib/validators';

/**
 * Erro de regra de negócio com mensagem destinada ao usuário final.
 *
 * Estende `ApiError` para que `toErrorResponse()` já saiba devolver o status e
 * a mensagem certos — sem isso, uma recusa legítima ("este é o último
 * administrador") virava um 500 genérico na tela.
 */
export class MutationError extends ApiError {
  constructor(message: string, status = 400) {
    super(message, status);
    this.name = 'MutationError';
  }
}

/* ── Auditoria ─────────────────────────────────────────────── */

export async function audit(
  userId: string | null,
  action: string,
  entity: string,
  entityId: string | null,
  payload?: unknown,
) {
  try {
    await db.insert(auditLogs).values({
      userId,
      action,
      entity,
      entityId,
      payload: payload ? (JSON.parse(JSON.stringify(payload)) as object) : null,
    });
  } catch (error) {
    // Auditoria nunca derruba a operação principal.
    console.error('[VFA] Falha ao gravar auditoria:', error);
  }
}

/** Slug único dentro de uma tabela. */
async function ensureUniqueSlug(
  table: 'players' | 'clubs' | 'competitions' | 'news',
  base: string,
  ignoreId?: string,
): Promise<string> {
  const map = { players, clubs, competitions, news } as const;
  const entity = map[table];

  const root = slugify(base) || 'item';
  let candidate = root;
  let counter = 2;

  // Loop curto: na prática resolve na primeira ou segunda tentativa.
  for (let attempt = 0; attempt < 50; attempt += 1) {
    const rows = await db
      .select({ id: entity.id })
      .from(entity)
      .where(
        ignoreId
          ? and(eq(entity.slug, candidate), ne(entity.id, ignoreId))
          : eq(entity.slug, candidate),
      )
      .limit(1);

    if (rows.length === 0) return candidate;
    candidate = `${root}-${counter}`;
    counter += 1;
  }

  return `${root}-${Date.now()}`;
}

/* ══════════════════════════════════════════════════════════════
   JOGADORES
   ══════════════════════════════════════════════════════════════ */

export async function createPlayer(input: PlayerCreateInput, actorId: string | null) {
  const slug = await ensureUniqueSlug('players', input.displayName);

  const [created] = await db
    .insert(players)
    .values({
      slug,
      displayName: input.displayName,
      robloxUsername: input.robloxUsername.trim(),
      nationId: input.nationId,
      currentClubId: input.currentClubId,
      shirtNumber: input.shirtNumber ?? null,
      position: input.position,
      isActive: input.isActive,
      joinedAt: input.joinedAt,
    })
    .returning();

  // Registra a entrada na liga para o histórico começar completo.
  if (input.currentClubId) {
    const season = await getActiveSeasonOrThrow();
    await db.insert(transfers).values({
      playerId: created.id,
      fromClubId: null,
      toClubId: input.currentClubId,
      seasonId: season.id,
      type: 'SIGNING',
      createdById: actorId,
    });
  }

  let robloxStatus: string | null = null;
  if (input.syncRoblox) {
    const result = await syncPlayerRoblox(created.id, true);
    robloxStatus = result.status;
  }

  await audit(actorId, 'create', 'player', created.id, { displayName: input.displayName });

  return { player: created, robloxStatus };
}

export async function updatePlayer(
  playerId: string,
  input: PlayerUpdateInput,
  actorId: string | null,
) {
  const [existing] = await db.select().from(players).where(eq(players.id, playerId)).limit(1);
  if (!existing) throw new MutationError('Jogador não encontrado.', 404);

  const patch: Partial<typeof players.$inferInsert> = {};

  if (input.displayName && input.displayName !== existing.displayName) {
    patch.displayName = input.displayName;
    patch.slug = await ensureUniqueSlug('players', input.displayName, playerId);
  }
  if (input.robloxUsername && input.robloxUsername !== existing.robloxUsername) {
    patch.robloxUsername = input.robloxUsername.trim();
    // Username novo invalida o cache: força nova sincronização.
    patch.robloxSyncedAt = null;
    patch.robloxUserId = null;
  }
  if (input.nationId !== undefined) patch.nationId = input.nationId;
  if (input.shirtNumber !== undefined) patch.shirtNumber = input.shirtNumber ?? null;
  if (input.position !== undefined) patch.position = input.position;
  if (input.isActive !== undefined) patch.isActive = input.isActive;
  if (input.joinedAt !== undefined) patch.joinedAt = input.joinedAt;

  // Mudança de clube passa pelo fluxo de transferência, para não perder
  // histórico (item 22 do escopo).
  const clubChanged =
    input.currentClubId !== undefined && input.currentClubId !== existing.currentClubId;

  await db.update(players).set(patch).where(eq(players.id, playerId));

  if (clubChanged) {
    await transferPlayer(
      {
        playerId,
        toClubId: input.currentClubId ?? null,
        seasonId: (await getActiveSeasonOrThrow()).id,
        type: input.currentClubId ? 'TRANSFER' : 'RELEASE',
        note: null,
      },
      actorId,
    );
  }

  if (input.syncRoblox) await syncPlayerRoblox(playerId, true);

  await audit(actorId, 'update', 'player', playerId, patch);

  const [updated] = await db.select().from(players).where(eq(players.id, playerId)).limit(1);
  return updated;
}

export async function deletePlayer(playerId: string, actorId: string | null) {
  const [existing] = await db.select().from(players).where(eq(players.id, playerId)).limit(1);
  if (!existing) throw new MutationError('Jogador não encontrado.', 404);

  // Se o jogador era capitão, o clube fica sem capitão em vez de bloquear
  // a exclusão com erro de chave estrangeira.
  await db.update(clubs).set({ captainId: null }).where(eq(clubs.captainId, playerId));
  await db.delete(players).where(eq(players.id, playerId));

  await audit(actorId, 'delete', 'player', playerId, { displayName: existing.displayName });
}

/** Transferência — item 22: o histórico nunca é apagado. */
export async function transferPlayer(input: TransferInput & { seasonId: string }, actorId: string | null) {
  const [player] = await db.select().from(players).where(eq(players.id, input.playerId)).limit(1);
  if (!player) throw new MutationError('Jogador não encontrado.', 404);

  const fromClubId = player.currentClubId;

  if (fromClubId === (input.toClubId ?? null)) {
    throw new MutationError('O jogador já está neste clube.');
  }

  await db.transaction(async (tx) => {
    await tx.insert(transfers).values({
      playerId: input.playerId,
      fromClubId,
      toClubId: input.toClubId ?? null,
      seasonId: input.seasonId,
      type: input.type,
      occurredAt: input.occurredAt ? new Date(input.occurredAt) : new Date(),
      note: input.note ?? null,
      createdById: actorId,
    });

    await tx
      .update(players)
      .set({ currentClubId: input.toClubId ?? null })
      .where(eq(players.id, input.playerId));

    // Sai do clube antigo também como capitão, se for o caso.
    if (fromClubId) {
      await tx.update(clubs).set({ captainId: null }).where(eq(clubs.captainId, input.playerId));
    }
  });

  await audit(actorId, 'transfer', 'player', input.playerId, {
    from: fromClubId,
    to: input.toClubId,
    type: input.type,
  });
}

/* ══════════════════════════════════════════════════════════════
   CLUBES
   ══════════════════════════════════════════════════════════════ */

export async function createClub(input: ClubCreateInput, actorId: string | null) {
  const slug = await ensureUniqueSlug('clubs', input.name);

  const [created] = await db
    .insert(clubs)
    .values({
      slug,
      name: input.name,
      shortName: input.shortName,
      abbreviation: input.abbreviation,
      leagueId: input.leagueId,
      nationId: input.nationId,
      logoUrl: input.logoUrl,
      primaryColor: input.primaryColor,
      secondaryColor: input.secondaryColor,
      ownerName: input.ownerName,
      stadium: input.stadium,
      foundedAt: input.foundedAt,
    })
    .returning();

  // Vincula o clube à temporada ativa, quando existir.
  const [season] = await db.select().from(seasons).where(eq(seasons.isActive, true)).limit(1);
  if (season) {
    await db
      .insert(clubSeasonMemberships)
      .values({ clubId: created.id, seasonId: season.id, leagueId: input.leagueId })
      .onConflictDoNothing();
  }

  await audit(actorId, 'create', 'club', created.id, { name: input.name });
  return created;
}

export async function updateClub(
  clubId: string,
  input: Partial<ClubCreateInput>,
  actorId: string | null,
) {
  const [existing] = await db.select().from(clubs).where(eq(clubs.id, clubId)).limit(1);
  if (!existing) throw new MutationError('Clube não encontrado.', 404);

  const patch: Partial<typeof clubs.$inferInsert> = { ...input };

  if (input.name && input.name !== existing.name) {
    patch.slug = await ensureUniqueSlug('clubs', input.name, clubId);
  }

  // O capitão precisa pertencer ao elenco — senão a página do clube mostraria
  // como capitão alguém que joga em outro time.
  if (input.captainId) {
    const [candidate] = await db
      .select({ currentClubId: players.currentClubId })
      .from(players)
      .where(eq(players.id, input.captainId))
      .limit(1);

    if (!candidate || candidate.currentClubId !== clubId) {
      throw new MutationError('O capitão precisa ser um jogador do elenco deste clube.');
    }
  }

  await db.update(clubs).set(patch).where(eq(clubs.id, clubId));
  await audit(actorId, 'update', 'club', clubId, patch);

  const [updated] = await db.select().from(clubs).where(eq(clubs.id, clubId)).limit(1);
  return updated;
}

export async function deleteClub(clubId: string, actorId: string | null) {
  const [existing] = await db.select().from(clubs).where(eq(clubs.id, clubId)).limit(1);
  if (!existing) throw new MutationError('Clube não encontrado.', 404);

  const [{ value: matchCount }] = await db
    .select({ value: sql<number>`count(*)::int` })
    .from(matches)
    .where(sql`${matches.homeClubId} = ${clubId} or ${matches.awayClubId} = ${clubId}`);

  if (matchCount > 0) {
    throw new MutationError(
      `Este clube tem ${matchCount} partida(s) registrada(s). Apagá-lo destruiria o histórico da liga. Remova as partidas primeiro, ou mantenha o clube arquivado.`,
      409,
    );
  }

  await db.update(players).set({ currentClubId: null }).where(eq(players.currentClubId, clubId));
  await db.delete(clubs).where(eq(clubs.id, clubId));

  await audit(actorId, 'delete', 'club', clubId, { name: existing.name });
}

/* ══════════════════════════════════════════════════════════════
   PARTIDAS
   ══════════════════════════════════════════════════════════════ */

export async function createMatch(input: MatchCreateInput, actorId: string | null) {
  const [competition] = await db
    .select({ seasonId: competitions.seasonId })
    .from(competitions)
    .where(eq(competitions.id, input.competitionId))
    .limit(1);

  if (!competition) throw new MutationError('Competição não encontrada.', 404);

  const [created] = await db
    .insert(matches)
    .values({
      seasonId: competition.seasonId,
      competitionId: input.competitionId,
      roundId: input.roundId,
      homeClubId: input.homeClubId,
      awayClubId: input.awayClubId,
      kickoffAt: new Date(input.kickoffAt),
      venue: input.venue,
      matchday: input.matchday ?? null,
      bracketSlot: input.bracketSlot ?? null,
      leg: input.leg,
      status: input.status,
      notes: input.notes,
    })
    .returning();

  await recomputeCompetition(input.competitionId);
  await audit(actorId, 'create', 'match', created.id, input);

  return created;
}

export async function updateMatch(
  matchId: string,
  input: Record<string, unknown>,
  actorId: string | null,
) {
  const [existing] = await db.select().from(matches).where(eq(matches.id, matchId)).limit(1);
  if (!existing) throw new MutationError('Partida não encontrada.', 404);

  const patch: Partial<typeof matches.$inferInsert> = {};
  if (typeof input.kickoffAt === 'string') patch.kickoffAt = new Date(input.kickoffAt);
  if (input.roundId !== undefined) patch.roundId = input.roundId as string | null;
  if (typeof input.homeClubId === 'string') patch.homeClubId = input.homeClubId;
  if (typeof input.awayClubId === 'string') patch.awayClubId = input.awayClubId;
  if (input.venue !== undefined) patch.venue = input.venue as string | null;
  if (input.matchday !== undefined) patch.matchday = (input.matchday as number) ?? null;
  if (typeof input.leg === 'number') patch.leg = input.leg;
  if (input.notes !== undefined) patch.notes = input.notes as string | null;

  if (typeof input.status === 'string') {
    patch.status = input.status as typeof existing.status;

    // Voltar uma partida para "agendada" ou cancelá-la limpa o placar — deixar
    // o placar antigo faria a tabela continuar contando um jogo que não
    // aconteceu.
    if (input.status === 'SCHEDULED' || input.status === 'CANCELLED' || input.status === 'POSTPONED') {
      patch.homeScore = null;
      patch.awayScore = null;
      patch.homePenalties = null;
      patch.awayPenalties = null;
    }
  }

  if (patch.homeClubId && patch.awayClubId && patch.homeClubId === patch.awayClubId) {
    throw new MutationError('Um clube não pode jogar contra ele mesmo.');
  }

  await db.update(matches).set(patch).where(eq(matches.id, matchId));
  await recomputeCompetition(existing.competitionId);
  await advanceBracket(existing.competitionId);
  await audit(actorId, 'update', 'match', matchId, patch);

  const [updated] = await db.select().from(matches).where(eq(matches.id, matchId)).limit(1);
  return updated;
}

export async function deleteMatch(matchId: string, actorId: string | null) {
  const [existing] = await db.select().from(matches).where(eq(matches.id, matchId)).limit(1);
  if (!existing) throw new MutationError('Partida não encontrada.', 404);

  await db.delete(matches).where(eq(matches.id, matchId));
  await recomputeCompetition(existing.competitionId);
  await audit(actorId, 'delete', 'match', matchId, null);
}

/**
 * Registro de resultado — o coração do sistema (item 35 do escopo).
 *
 * Placar, escalações e eventos entram numa transação só. Depois disso a
 * competição é recalculada, o chaveamento avança e o campeão é reavaliado.
 * É por isso que a tabela "se atualiza sozinha": ninguém a edita à mão.
 */
export async function saveMatchResult(
  matchId: string,
  input: MatchResultInput,
  actorId: string | null,
) {
  const [match] = await db.select().from(matches).where(eq(matches.id, matchId)).limit(1);
  if (!match) throw new MutationError('Partida não encontrada.', 404);

  const validClubs = new Set([match.homeClubId, match.awayClubId]);

  for (const event of input.events) {
    if (!validClubs.has(event.clubId)) {
      throw new MutationError('Um evento foi atribuído a um clube que não está nesta partida.');
    }
  }
  for (const appearance of input.appearances) {
    if (!validClubs.has(appearance.clubId)) {
      throw new MutationError('Uma escalação foi atribuída a um clube que não está nesta partida.');
    }
  }

  await db.transaction(async (tx) => {
    await tx
      .update(matches)
      .set({
        homeScore: input.homeScore,
        awayScore: input.awayScore,
        homePenalties: input.homePenalties ?? null,
        awayPenalties: input.awayPenalties ?? null,
        status: input.status,
      })
      .where(eq(matches.id, matchId));

    // Substituição completa: o payload é a verdade sobre esta partida.
    await tx.delete(matchEvents).where(eq(matchEvents.matchId, matchId));
    await tx.delete(matchAppearances).where(eq(matchAppearances.matchId, matchId));

    if (input.appearances.length > 0) {
      await tx.insert(matchAppearances).values(
        input.appearances.map((appearance) => ({
          matchId,
          playerId: appearance.playerId,
          clubId: appearance.clubId,
          minutes: appearance.minutes,
          started: appearance.started,
        })),
      );
    }

    if (input.events.length > 0) {
      await tx.insert(matchEvents).values(
        input.events.map((event) => ({
          matchId,
          clubId: event.clubId,
          playerId: event.playerId,
          assistPlayerId: event.assistPlayerId,
          type: event.type,
          minute: event.minute ?? null,
          detail: event.detail,
        })),
      );
    }
  });

  await recomputeCompetition(match.competitionId);
  await advanceBracket(match.competitionId);
  await resolveChampion(match.competitionId);

  await audit(actorId, 'result', 'match', matchId, {
    homeScore: input.homeScore,
    awayScore: input.awayScore,
    events: input.events.length,
  });

  const [updated] = await db.select().from(matches).where(eq(matches.id, matchId)).limit(1);
  return updated;
}

/* ══════════════════════════════════════════════════════════════
   COMPETIÇÕES
   ══════════════════════════════════════════════════════════════ */

export async function createCompetition(input: CompetitionInput, actorId: string | null) {
  const slug = await ensureUniqueSlug('competitions', input.name);

  const [created] = await db
    .insert(competitions)
    .values({
      slug,
      name: input.name,
      shortName: input.shortName,
      type: input.type,
      status: input.status,
      seasonId: input.seasonId,
      leagueId: input.leagueId,
      parentSlug: input.parentSlug,
      logoUrl: input.logoUrl,
      accent: input.accent ?? null,
      sortOrder: input.sortOrder,
      config: input.config,
    })
    .returning();

  await audit(actorId, 'create', 'competition', created.id, { name: input.name });
  return created;
}

export async function updateCompetition(
  competitionId: string,
  input: Partial<CompetitionInput>,
  actorId: string | null,
) {
  const [existing] = await db
    .select()
    .from(competitions)
    .where(eq(competitions.id, competitionId))
    .limit(1);
  if (!existing) throw new MutationError('Competição não encontrada.', 404);

  const patch: Partial<typeof competitions.$inferInsert> = { ...input };
  if (input.name && input.name !== existing.name) {
    patch.slug = await ensureUniqueSlug('competitions', input.name, competitionId);
  }

  await db.update(competitions).set(patch).where(eq(competitions.id, competitionId));

  // Mudou a pontuação ou o desempate? A tabela inteira precisa ser refeita.
  if (input.config) await recomputeCompetition(competitionId);

  await audit(actorId, 'update', 'competition', competitionId, patch);

  const [updated] = await db
    .select()
    .from(competitions)
    .where(eq(competitions.id, competitionId))
    .limit(1);
  return updated;
}

export async function setCompetitionTeams(
  competitionId: string,
  clubIds: string[],
  groups: Record<string, string> | undefined,
  actorId: string | null,
) {
  const existingMatches = await db
    .select({ id: matches.id, homeClubId: matches.homeClubId, awayClubId: matches.awayClubId })
    .from(matches)
    .where(eq(matches.competitionId, competitionId));

  const incoming = new Set(clubIds);
  const orphaned = existingMatches.filter(
    (match) => !incoming.has(match.homeClubId) || !incoming.has(match.awayClubId),
  );

  if (orphaned.length > 0) {
    throw new MutationError(
      `${orphaned.length} partida(s) já cadastrada(s) envolvem clubes que você está removendo. Apague ou reatribua essas partidas antes de mudar os participantes.`,
      409,
    );
  }

  await db.transaction(async (tx) => {
    await tx.delete(competitionTeams).where(eq(competitionTeams.competitionId, competitionId));
    if (clubIds.length > 0) {
      await tx.insert(competitionTeams).values(
        clubIds.map((clubId, index) => ({
          competitionId,
          clubId,
          groupName: groups?.[clubId] ?? null,
          seed: index + 1,
        })),
      );
    }
  });

  await recomputeCompetition(competitionId);
  await audit(actorId, 'set-teams', 'competition', competitionId, { count: clubIds.length });
}

export async function deleteCompetition(competitionId: string, actorId: string | null) {
  const [existing] = await db
    .select()
    .from(competitions)
    .where(eq(competitions.id, competitionId))
    .limit(1);
  if (!existing) throw new MutationError('Competição não encontrada.', 404);

  await db.delete(competitions).where(eq(competitions.id, competitionId));
  await audit(actorId, 'delete', 'competition', competitionId, { name: existing.name });
}

/** Zonas de classificação da liga (item 10). */
export async function setQualificationZones(
  leagueId: string,
  zones: {
    label: string;
    color: string;
    fromPosition: number;
    toPosition: number;
    targetSlug: string | null;
    sortOrder: number;
  }[],
  actorId: string | null,
) {
  await db.transaction(async (tx) => {
    await tx.delete(qualificationZones).where(eq(qualificationZones.leagueId, leagueId));
    if (zones.length > 0) {
      await tx.insert(qualificationZones).values(zones.map((zone) => ({ ...zone, leagueId })));
    }
  });

  await audit(actorId, 'set-zones', 'league', leagueId, { count: zones.length });
}

/* ══════════════════════════════════════════════════════════════
   NOTÍCIAS
   ══════════════════════════════════════════════════════════════ */


/**
 * Campos traduzidos, prontos para gravar.
 *
 * O conteúdo em inglês e espanhol passa pelo MESMO saneamento do português.
 * Seria fácil esquecer isso — são campos "secundários", preenchidos depois —
 * e o esquecimento abriria exatamente o buraco que o saneamento fecha: HTML
 * com script gravado no banco, servido a todo visitante que ler no idioma
 * traduzido. Um caminho de entrada sem saneamento anula os outros.
 */
function translationFields(input: NewsInput) {
  return {
    titleEn: input.titleEn,
    subtitleEn: input.subtitleEn,
    excerptEn: input.excerptEn,
    contentEn: input.contentEn ? sanitizeNewsHtml(input.contentEn) : null,

    titleEs: input.titleEs,
    subtitleEs: input.subtitleEs,
    excerptEs: input.excerptEs,
    contentEs: input.contentEs ? sanitizeNewsHtml(input.contentEs) : null,
  };
}

export async function createNews(input: NewsInput, actorId: string | null) {
  const slug = await ensureUniqueSlug('news', input.title);
  // Sanitiza ANTES de gravar: o banco nunca guarda HTML não confiável.
  const content = sanitizeNewsHtml(input.content);

  const [created] = await db
    .insert(news)
    .values({
      slug,
      title: input.title,
      subtitle: input.subtitle,
      excerpt: input.excerpt ?? buildExcerpt(content),
      content,
      ...translationFields(input),
      coverImageUrl: input.coverImageUrl,
      categoryId: input.categoryId,
      authorId: actorId,
      status: input.status,
      isFeatured: input.isFeatured,
      publishedAt: input.status === 'PUBLISHED' ? new Date() : null,
      scheduledFor: input.scheduledFor ? new Date(input.scheduledFor) : null,
    })
    .returning();

  await audit(actorId, 'create', 'news', created.id, { title: input.title });
  return created;
}

export async function updateNews(newsId: string, input: NewsInput, actorId: string | null) {
  const [existing] = await db.select().from(news).where(eq(news.id, newsId)).limit(1);
  if (!existing) throw new MutationError('Notícia não encontrada.', 404);

  const content = sanitizeNewsHtml(input.content);

  const patch: Partial<typeof news.$inferInsert> = {
    title: input.title,
    subtitle: input.subtitle,
    excerpt: input.excerpt ?? buildExcerpt(content),
    content,
    ...translationFields(input),
    coverImageUrl: input.coverImageUrl,
    categoryId: input.categoryId,
    status: input.status,
    isFeatured: input.isFeatured,
    scheduledFor: input.scheduledFor ? new Date(input.scheduledFor) : null,
  };

  if (input.title !== existing.title) {
    patch.slug = await ensureUniqueSlug('news', input.title, newsId);
  }

  // A data de publicação é carimbada uma vez só: republicar não muda a data
  // original da matéria.
  if (input.status === 'PUBLISHED' && !existing.publishedAt) {
    patch.publishedAt = new Date();
  }
  if (input.status !== 'PUBLISHED') {
    patch.publishedAt = existing.status === 'PUBLISHED' ? existing.publishedAt : null;
  }

  await db.update(news).set(patch).where(eq(news.id, newsId));
  await audit(actorId, 'update', 'news', newsId, { title: input.title, status: input.status });

  const [updated] = await db.select().from(news).where(eq(news.id, newsId)).limit(1);
  return updated;
}

export async function deleteNews(newsId: string, actorId: string | null) {
  await db.delete(news).where(eq(news.id, newsId));
  await audit(actorId, 'delete', 'news', newsId, null);
}

/**
 * Publica as notícias agendadas cuja hora já chegou.
 * Chamada na leitura da lista do painel e por `/api/cron/publish`, para não
 * depender de um agendador externo obrigatório.
 */
export async function publishScheduledNews(): Promise<number> {
  const due = await db
    .select({ id: news.id })
    .from(news)
    .where(
      and(
        eq(news.status, 'SCHEDULED'),
        sql`${news.scheduledFor} is not null and ${news.scheduledFor} <= now()`,
      ),
    );

  if (due.length === 0) return 0;

  for (const item of due) {
    await db
      .update(news)
      .set({ status: 'PUBLISHED', publishedAt: new Date() })
      .where(eq(news.id, item.id));
  }

  return due.length;
}

/* ══════════════════════════════════════════════════════════════
   TEMPORADAS
   ══════════════════════════════════════════════════════════════ */

export async function getActiveSeasonOrThrow() {
  const [season] = await db.select().from(seasons).where(eq(seasons.isActive, true)).limit(1);
  if (season) return season;

  const [latest] = await db.select().from(seasons).orderBy(sql`${seasons.year} desc`).limit(1);
  if (latest) return latest;

  throw new MutationError('Nenhuma temporada cadastrada. Crie uma antes de continuar.', 409);
}

export async function createSeason(
  input: {
    year: number;
    name: string;
    tagline: string | null;
    bannerUrl: string | null;
    startDate: Date | null;
    endDate: Date | null;
  },
  actorId: string | null,
) {
  const [created] = await db.insert(seasons).values(input).returning();
  await audit(actorId, 'create', 'season', created.id, { year: input.year });
  return created;
}

/** Só uma temporada ativa por vez — garantido aqui, numa transação. */
export async function activateSeason(seasonId: string, actorId: string | null) {
  await db.transaction(async (tx) => {
    await tx.update(seasons).set({ isActive: false }).where(eq(seasons.isActive, true));
    await tx
      .update(seasons)
      .set({ isActive: true, isArchived: false })
      .where(eq(seasons.id, seasonId));
  });

  await audit(actorId, 'activate', 'season', seasonId, null);
}

export async function archiveSeason(seasonId: string, actorId: string | null) {
  await db
    .update(seasons)
    .set({ isActive: false, isArchived: true })
    .where(eq(seasons.id, seasonId));
  await audit(actorId, 'archive', 'season', seasonId, null);
}

/**
 * Recalcula tudo de uma temporada. Botão de emergência do painel para quando
 * alguém mexeu no banco por fora.
 */
export async function recomputeEverything(seasonId: string, actorId: string | null) {
  await recomputeSeason(seasonId);
  await audit(actorId, 'recompute', 'season', seasonId, null);
}

/* ══════════════════════════════════════════════════════════════
   USUÁRIOS
   ══════════════════════════════════════════════════════════════ */

export async function updateUser(
  userId: string,
  input: { role?: 'USER' | 'ADMIN'; isBanned?: boolean },
  actorId: string | null,
) {
  if (userId === actorId && input.role === 'USER') {
    throw new MutationError('Você não pode rebaixar a sua própria conta.', 409);
  }
  if (userId === actorId && input.isBanned) {
    throw new MutationError('Você não pode banir a sua própria conta.', 409);
  }

  // Nunca deixar a liga sem nenhum administrador.
  if (input.role === 'USER' || input.isBanned) {
    const [{ value: adminCount }] = await db
      .select({ value: sql<number>`count(*)::int` })
      .from(users)
      .where(and(eq(users.role, 'ADMIN'), eq(users.isBanned, false)));

    const [target] = await db
      .select({ role: users.role, isBanned: users.isBanned })
      .from(users)
      .where(eq(users.id, userId))
      .limit(1);

    if (target?.role === 'ADMIN' && !target.isBanned && adminCount <= 1) {
      throw new MutationError(
        'Este é o último administrador ativo. Promova outra pessoa antes de remover o acesso deste usuário.',
        409,
      );
    }
  }

  await db.update(users).set(input).where(eq(users.id, userId));
  await audit(actorId, 'update', 'user', userId, input);

  const [updated] = await db.select().from(users).where(eq(users.id, userId)).limit(1);
  return updated;
}
