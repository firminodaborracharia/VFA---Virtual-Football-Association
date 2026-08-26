import { adminRoute, fail, ok } from '@/lib/api';
import { recomputeEverything } from '@/lib/mutations';
import { getActiveSeason } from '@/lib/queries';

export const dynamic = 'force-dynamic';

/**
 * POST /api/admin/recompute
 * Recalcula tabelas e estatísticas de toda a temporada. Útil depois de uma
 * importação manual ou de uma mudança nas regras de pontuação.
 */
export const POST = adminRoute(async (request, { session }) => {
  const url = new URL(request.url);
  const seasonId = url.searchParams.get('seasonId') ?? (await getActiveSeason())?.id;

  if (!seasonId) return fail('Nenhuma temporada encontrada.', 404);

  await recomputeEverything(seasonId, session.user.id);
  return ok({ recomputed: true, seasonId });
});
