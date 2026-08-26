import { fail, ok, route } from '@/lib/api';
import {
  getActiveSeason,
  getLeagueCompetition,
  getQualificationZones,
  getStandings,
  listLeagues,
} from '@/lib/queries';

export const dynamic = 'force-dynamic';

/**
 * GET /api/standings
 *  ?competitionId=… → tabela de uma competição específica
 *  (sem parâmetro)  → tabelas de todas as ligas na temporada ativa
 */
export const GET = route(async (request) => {
  const url = new URL(request.url);
  const competitionId = url.searchParams.get('competitionId');

  if (competitionId) {
    return ok(await getStandings(competitionId));
  }

  const season = await getActiveSeason();
  if (!season) return fail('Nenhuma temporada cadastrada.', 404);

  const leagues = await listLeagues();
  const tables = await Promise.all(
    leagues.map(async (league) => {
      const competition = await getLeagueCompetition(league.id, season.id);
      return {
        league,
        competition,
        zones: await getQualificationZones(league.id),
        standings: competition ? await getStandings(competition.id) : [],
      };
    }),
  );

  return ok(tables, { season });
});
