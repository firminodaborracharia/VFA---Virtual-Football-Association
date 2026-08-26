import { ok, route } from '@/lib/api';
import { getQualificationZones, listLeagues } from '@/lib/queries';

export const dynamic = 'force-dynamic';

export const GET = route(async () => {
  const leagues = await listLeagues();
  const withZones = await Promise.all(
    leagues.map(async (league) => ({
      ...league,
      qualificationZones: await getQualificationZones(league.id),
    })),
  );
  return ok(withZones);
});
