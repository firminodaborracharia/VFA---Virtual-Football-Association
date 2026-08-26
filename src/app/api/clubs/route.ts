import { ok, route } from '@/lib/api';
import { listClubs } from '@/lib/queries';

export const dynamic = 'force-dynamic';

export const GET = route(async (request) => {
  const url = new URL(request.url);
  const rows = await listClubs({
    leagueId: url.searchParams.get('leagueId') ?? undefined,
    search: url.searchParams.get('q') ?? undefined,
  });
  return ok(rows, { total: rows.length });
});
