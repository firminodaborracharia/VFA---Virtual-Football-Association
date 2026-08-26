import { ok, paginationMeta, readPagination, route } from '@/lib/api';
import { getActiveSeason, listMatches } from '@/lib/queries';

export const dynamic = 'force-dynamic';

export const GET = route(async (request) => {
  const url = new URL(request.url);
  const pagination = readPagination(request, 30, 100);

  const seasonParam = url.searchParams.get('seasonId');
  const season = seasonParam ? null : await getActiveSeason();

  const { rows, total } = await listMatches({
    seasonId: seasonParam ?? season?.id,
    competitionId: url.searchParams.get('competitionId') ?? undefined,
    leagueId: url.searchParams.get('leagueId') ?? undefined,
    clubId: url.searchParams.get('clubId') ?? undefined,
    status: (url.searchParams.get('status') as never) ?? undefined,
    order: url.searchParams.get('order') === 'desc' ? 'desc' : 'asc',
    limit: pagination.perPage,
    offset: pagination.offset,
  });

  return ok(rows, paginationMeta(pagination, total));
});
