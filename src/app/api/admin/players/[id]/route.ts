import { adminRoute, ok, readBody } from '@/lib/api';
import { deletePlayer, updatePlayer } from '@/lib/mutations';
import { playerUpdateSchema } from '@/lib/validators';

export const dynamic = 'force-dynamic';

export const PATCH = adminRoute(async (request, { params, session }) => {
  const { id } = await params;
  const input = await readBody(request, playerUpdateSchema);
  return ok(await updatePlayer(id, input, session.user.id));
});

export const DELETE = adminRoute(async (_request, { params, session }) => {
  const { id } = await params;
  await deletePlayer(id, session.user.id);
  return ok({ deleted: true });
});
