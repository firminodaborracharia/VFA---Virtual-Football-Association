import { adminRoute, ok, readBody } from '@/lib/api';
import { createClub } from '@/lib/mutations';
import { clubCreateSchema } from '@/lib/validators';

export const dynamic = 'force-dynamic';

export const POST = adminRoute(async (request, { session }) => {
  const input = await readBody(request, clubCreateSchema);
  return ok(await createClub(input, session.user.id), undefined, { status: 201 });
});
