import { notFoundResponse, ok, route } from '@/lib/api';
import {
  getCompetitionBySlug,
  getCompetitionMatches,
  getCompetitionRounds,
  getCompetitionTeams,
  getStandings,
} from '@/lib/queries';

export const dynamic = 'force-dynamic';

export const GET = route(async (_request, context) => {
  const { slug } = await context.params;

  const competition = await getCompetitionBySlug(slug);
  if (!competition) return notFoundResponse('Competição');

  const [teams, rounds, matches, standings] = await Promise.all([
    getCompetitionTeams(competition.id),
    getCompetitionRounds(competition.id),
    getCompetitionMatches(competition.id),
    getStandings(competition.id),
  ]);

  return ok({ competition, teams, rounds, matches, standings });
});
