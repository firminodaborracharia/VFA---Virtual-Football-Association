import { adminRoute, ok, readBody } from '@/lib/api';
import { updateUser } from '@/lib/mutations';
import { userUpdateSchema } from '@/lib/validators';

export const dynamic = 'force-dynamic';

/** PATCH /api/admin/users/:id — promove, rebaixa ou bane um usuário. */
export const PATCH = adminRoute(async (request, { params, session }) => {
  const { id } = await params;
  const input = await readBody(request, userUpdateSchema);
  return ok(await updateUser(id, input, session.user.id));
});
