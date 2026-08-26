import { adminRoute, ok, readBody } from '@/lib/api';
import { deleteClub, updateClub } from '@/lib/mutations';
import { clubUpdateSchema } from '@/lib/validators';

export const dynamic = 'force-dynamic';

export const PATCH = adminRoute(async (request, { params, session }) => {
  const { id } = await params;
  const input = await readBody(request, clubUpdateSchema);
  return ok(await updateClub(id, input, session.user.id));
});

export const DELETE = adminRoute(async (_request, { params, session }) => {
  const { id } = await params;
  await deleteClub(id, session.user.id);
  return ok({ deleted: true });
});
