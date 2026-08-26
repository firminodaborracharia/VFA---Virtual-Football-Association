import { ok, paginationMeta, readPagination, route } from '@/lib/api';
import { listPlayers } from '@/lib/queries';

export const dynamic = 'force-dynamic';

/** GET /api/players — lista pública com filtros e paginação. */
export const GET = route(async (request) => {
  const url = new URL(request.url);
  const pagination = readPagination(request, 24, 100);

  const { rows, total } = await listPlayers({
    search: url.searchParams.get('q') ?? undefined,
    leagueId: url.searchParams.get('leagueId') ?? undefined,
    clubId: url.searchParams.get('clubId') ?? undefined,
    nationId: url.searchParams.get('nationId') ?? undefined,
    position: (url.searchParams.get('position') as never) ?? undefined,
    limit: pagination.perPage,
    offset: pagination.offset,
  });

  return ok(rows, paginationMeta(pagination, total));
});
