import { adminRoute, ok, readBody } from '@/lib/api';
import { setCompetitionTeams } from '@/lib/mutations';
import { competitionTeamsSchema } from '@/lib/validators';

export const dynamic = 'force-dynamic';

/** PUT /api/admin/competitions/:id/teams — define os participantes. */
export const PUT = adminRoute(async (request, { params, session }) => {
  const { id } = await params;
  const input = await readBody(request, competitionTeamsSchema);
  await setCompetitionTeams(id, input.clubIds, input.groups, session.user.id);
  return ok({ count: input.clubIds.length });
});
