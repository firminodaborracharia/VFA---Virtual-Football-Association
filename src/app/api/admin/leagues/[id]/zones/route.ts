import { adminRoute, ok, readBody } from '@/lib/api';
import { setQualificationZones } from '@/lib/mutations';
import { qualificationZonesSchema } from '@/lib/validators';

export const dynamic = 'force-dynamic';

/**
 * PUT /api/admin/leagues/:id/zones
 * Define as faixas de classificação da tabela (item 10 do escopo).
 */
export const PUT = adminRoute(async (request, { params, session }) => {
  const { id } = await params;
  const input = await readBody(request, qualificationZonesSchema.omit({ leagueId: true }));

  await setQualificationZones(
    id,
    input.zones.map((zone) => ({
      label: zone.label,
      color: zone.color,
      fromPosition: zone.fromPosition,
      toPosition: zone.toPosition,
      targetSlug: zone.targetSlug ?? null,
      sortOrder: zone.sortOrder,
    })),
    session.user.id,
  );

  return ok({ count: input.zones.length });
});
