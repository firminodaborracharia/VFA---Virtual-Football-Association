import { adminRoute, ok, readBody } from '@/lib/api';
import { createCompetition } from '@/lib/mutations';
import { competitionSchema } from '@/lib/validators';

export const dynamic = 'force-dynamic';

export const POST = adminRoute(async (request, { session }) => {
  const input = await readBody(request, competitionSchema);
  return ok(await createCompetition(input, session.user.id), undefined, { status: 201 });
});
