/**
 * Busca global — item 26 do escopo.
 * Consulta jogadores, clubes, competições, partidas e notícias numa chamada só.
 */

import { and, eq, ilike, isNotNull, lte, or, sql } from 'drizzle-orm';

import { db } from '@/db';
import { clubs, competitions, matches, news, players } from '@/db/schema';
import { clientKey, fail, ok, rateLimit, route } from '@/lib/api';
import { alias } from 'drizzle-orm/pg-core';

export const dynamic = 'force-dynamic';

type SearchResult = {
  type: 'player' | 'club' | 'match' | 'competition' | 'news';
  id: string;
  title: string;
  subtitle: string | null;
  href: string;
  imageUrl: string | null;
};

export const GET = route(async (request) => {
  // Busca é a rota pública mais fácil de abusar: limite por IP.
  if (!rateLimit(clientKey(request, 'search'), 40, 60_000)) {
    return fail('Muitas buscas seguidas. Aguarde um instante.', 429);
  }

  const url = new URL(request.url);
  const term = (url.searchParams.get('q') ?? '').trim();

  if (term.length < 2) return ok<SearchResult[]>([]);

  const like = `%${term}%`;
  const results: SearchResult[] = [];

  // ── Jogadores ──
  const playerRows = await db
    .select({
      id: players.id,
      slug: players.slug,
      displayName: players.displayName,
      robloxUsername: players.robloxUsername,
      headshot: players.robloxHeadshotUrl,
      clubName: clubs.name,
    })
    .from(players)
    .leftJoin(clubs, eq(players.currentClubId, clubs.id))
    .where(
      or(
        ilike(players.displayName, like),
        ilike(players.robloxUsername, like),
        ilike(players.robloxDisplayName, like),
      ),
    )
    .limit(6);

  results.push(
    ...playerRows.map((row) => ({
      type: 'player' as const,
      id: row.id,
      title: row.displayName,
      subtitle: row.clubName ? `${row.clubName} · @${row.robloxUsername}` : `@${row.robloxUsername}`,
      href: `/jogadores/${row.slug}`,
      imageUrl: row.headshot,
    })),
  );

  // ── Clubes ──
  const clubRows = await db
    .select({
      id: clubs.id,
      slug: clubs.slug,
      name: clubs.name,
      shortName: clubs.shortName,
      logoUrl: clubs.logoUrl,
    })
    .from(clubs)
    .where(or(ilike(clubs.name, like), ilike(clubs.shortName, like), ilike(clubs.abbreviation, like)))
    .limit(5);

  results.push(
    ...clubRows.map((row) => ({
      type: 'club' as const,
      id: row.id,
      title: row.name,
      subtitle: row.shortName,
      href: `/clubes/${row.slug}`,
      imageUrl: row.logoUrl,
    })),
  );

  // ── Competições ──
  const competitionRows = await db
    .select({
      id: competitions.id,
      slug: competitions.slug,
      name: competitions.name,
      shortName: competitions.shortName,
      logoUrl: competitions.logoUrl,
    })
    .from(competitions)
    .where(or(ilike(competitions.name, like), ilike(competitions.shortName, like)))
    .limit(4);

  results.push(
    ...competitionRows.map((row) => ({
      type: 'competition' as const,
      id: row.id,
      title: row.name,
      subtitle: row.shortName,
      href: `/competicoes/${row.slug}`,
      imageUrl: row.logoUrl,
    })),
  );

  // ── Partidas (busca pelo nome de um dos clubes) ──
  const homeAlias = alias(clubs, 'search_home');
  const awayAlias = alias(clubs, 'search_away');

  const matchRows = await db
    .select({
      id: matches.id,
      kickoffAt: matches.kickoffAt,
      homeScore: matches.homeScore,
      awayScore: matches.awayScore,
      homeName: homeAlias.shortName,
      awayName: awayAlias.shortName,
      homeLogo: homeAlias.logoUrl,
      competitionName: competitions.name,
    })
    .from(matches)
    .innerJoin(homeAlias, eq(matches.homeClubId, homeAlias.id))
    .innerJoin(awayAlias, eq(matches.awayClubId, awayAlias.id))
    .innerJoin(competitions, eq(matches.competitionId, competitions.id))
    .where(or(ilike(homeAlias.name, like), ilike(awayAlias.name, like)))
    .orderBy(sql`${matches.kickoffAt} desc`)
    .limit(4);

  results.push(
    ...matchRows.map((row) => {
      const score =
        row.homeScore !== null && row.awayScore !== null
          ? `${row.homeScore} × ${row.awayScore}`
          : '×';
      return {
        type: 'match' as const,
        id: row.id,
        title: `${row.homeName} ${score} ${row.awayName}`,
        subtitle: row.competitionName,
        href: `/partidas/${row.id}`,
        imageUrl: row.homeLogo,
      };
    }),
  );

  // ── Notícias (apenas publicadas) ──
  const newsRows = await db
    .select({
      id: news.id,
      slug: news.slug,
      title: news.title,
      subtitle: news.subtitle,
      coverImageUrl: news.coverImageUrl,
    })
    .from(news)
    .where(
      and(
        eq(news.status, 'PUBLISHED'),
        isNotNull(news.publishedAt),
        lte(news.publishedAt, new Date()),
        or(ilike(news.title, like), ilike(news.subtitle, like), ilike(news.excerpt, like)),
      ),
    )
    .limit(4);

  results.push(
    ...newsRows.map((row) => ({
      type: 'news' as const,
      id: row.id,
      title: row.title,
      subtitle: row.subtitle,
      href: `/noticias/${row.slug}`,
      imageUrl: row.coverImageUrl,
    })),
  );

  return ok(results);
});
