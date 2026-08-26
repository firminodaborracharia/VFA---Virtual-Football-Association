import { notFoundResponse, ok, route } from '@/lib/api';
import {
  getActiveSeason,
  getClubBySlug,
  getClubSeasonTotals,
  getClubSquad,
  listMatches,
} from '@/lib/queries';

export const dynamic = 'force-dynamic';

export const GET = route(async (_request, context) => {
  const { id } = await context.params;

  const club = await getClubBySlug(id);
  if (!club) return notFoundResponse('Clube');

  const season = await getActiveSeason();
  const [squad, totals, recent, upcoming] = await Promise.all([
    getClubSquad(club.id),
    season
      ? getClubSeasonTotals(club.id, season.id)
      : Promise.resolve(null),
    listMatches({ clubId: club.id, status: 'FINISHED', limit: 5, order: 'desc' }),
    listMatches({ clubId: club.id, status: 'SCHEDULED', limit: 5, order: 'asc' }),
  ]);

  return ok({ club, squad, totals, recentMatches: recent.rows, upcomingMatches: upcoming.rows });
});
