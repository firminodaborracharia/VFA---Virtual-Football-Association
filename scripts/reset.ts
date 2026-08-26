/**
 * Apaga os dados de demonstração (tudo marcado com isDemo).
 * O que foi cadastrado de verdade pela VFA permanece intacto.
 *
 * Passe --all para limpar TODAS as tabelas de conteúdo (mantém usuários e
 * configurações). Útil para recomeçar do zero em desenvolvimento.
 */

import './load-env';
import { eq } from 'drizzle-orm';
import { drizzle } from 'drizzle-orm/postgres-js';
import postgres from 'postgres';

import * as schema from '../src/db/schema';

const {
  clubSeasonMemberships,
  clubSeasonStats,
  clubs,
  competitionRounds,
  competitionTeams,
  competitions,
  matchAppearances,
  matchEvents,
  matches,
  news,
  newsCategories,
  players,
  playerSeasonStats,
  qualificationZones,
  seasons,
  transfers,
} = schema;

async function main() {
  const url = process.env.DATABASE_URL;
  if (!url) {
    console.error('\n✗ DATABASE_URL não definida.\n');
    process.exit(1);
  }

  const all = process.argv.includes('--all');
  const client = postgres(url, { max: 1, prepare: false });
  const db = drizzle(client, { schema });

  try {
    if (all) {
      console.log('→ Apagando TODO o conteúdo (usuários e configurações são mantidos)…');
      // A ordem respeita as chaves estrangeiras; o resto cai em cascata.
      await db.delete(matchEvents);
      await db.delete(matchAppearances);
      await db.delete(matches);
      await db.delete(playerSeasonStats);
      await db.delete(clubSeasonStats);
      await db.delete(competitionRounds);
      await db.delete(competitionTeams);
      await db.delete(competitions);
      await db.delete(transfers);
      await db.update(clubs).set({ captainId: null });
      await db.delete(players);
      await db.delete(clubSeasonMemberships);
      await db.delete(clubs);
      await db.delete(qualificationZones);
      await db.delete(news);
      await db.delete(newsCategories);
      await db.delete(seasons);
    } else {
      console.log('→ Apagando apenas os dados de demonstração…');
      await db.delete(news).where(eq(news.isDemo, true));

      const demoMatches = await db.select({ id: matches.id }).from(matches).where(eq(matches.isDemo, true));
      for (const match of demoMatches) {
        await db.delete(matchEvents).where(eq(matchEvents.matchId, match.id));
        await db.delete(matchAppearances).where(eq(matchAppearances.matchId, match.id));
      }
      await db.delete(matches).where(eq(matches.isDemo, true));

      await db.update(clubs).set({ captainId: null }).where(eq(clubs.isDemo, true));
      await db.delete(players).where(eq(players.isDemo, true));
      await db.delete(competitions).where(eq(competitions.isDemo, true));
      await db.delete(clubs).where(eq(clubs.isDemo, true));
    }

    console.log('✓ Pronto.\n');
  } catch (error) {
    console.error('\n✗ Falha ao limpar:\n', error, '\n');
    process.exitCode = 1;
  } finally {
    await client.end();
  }
}

void main();
