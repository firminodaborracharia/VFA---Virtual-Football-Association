import { adminRoute, ok, readBody } from '@/lib/api';
import { saveMatchResult } from '@/lib/mutations';
import { matchResultSchema } from '@/lib/validators';

export const dynamic = 'force-dynamic';

/**
 * POST /api/admin/matches/:id/result
 *
 * Grava placar, escalações e eventos numa transação; depois a tabela, as
 * estatísticas individuais, o chaveamento e o campeão são recalculados.
 */
export const POST = adminRoute(async (request, { params, session }) => {
  const { id } = await params;
  const input = await readBody(request, matchResultSchema);
  return ok(await saveMatchResult(id, input, session.user.id));
});
