import { adminRoute, ok, readBody } from '@/lib/api';
import { deleteMatch, updateMatch } from '@/lib/mutations';
import { matchUpdateSchema } from '@/lib/validators';

export const dynamic = 'force-dynamic';

export const PATCH = adminRoute(async (request, { params, session }) => {
  const { id } = await params;
  const input = await readBody(request, matchUpdateSchema);
  return ok(await updateMatch(id, input as Record<string, unknown>, session.user.id));
});

export const DELETE = adminRoute(async (_request, { params, session }) => {
  const { id } = await params;
  await deleteMatch(id, session.user.id);
  return ok({ deleted: true });
});
