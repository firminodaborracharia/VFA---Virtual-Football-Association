import { fail, ok, route } from '@/lib/api';
import { getActiveSeason, listCompetitions, listSeasons } from '@/lib/queries';

export const dynamic = 'force-dynamic';

export const GET = route(async (request) => {
  const url = new URL(request.url);
  const yearParam = url.searchParams.get('year');

  const seasons = await listSeasons();
  const season = yearParam
    ? seasons.find((item) => item.year === Number(yearParam))
    : await getActiveSeason();

  if (!season) return fail('Temporada não encontrada.', 404);

  return ok(await listCompetitions(season.id), { season });
});
