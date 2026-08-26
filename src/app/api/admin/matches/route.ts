import { adminRoute, ok, readBody } from '@/lib/api';
import { createMatch } from '@/lib/mutations';
import { matchCreateSchema } from '@/lib/validators';

export const dynamic = 'force-dynamic';

export const POST = adminRoute(async (request, { session }) => {
  const input = await readBody(request, matchCreateSchema);
  return ok(await createMatch(input, session.user.id), undefined, { status: 201 });
});
