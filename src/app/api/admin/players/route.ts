import { adminRoute, ok, readBody } from '@/lib/api';
import { createPlayer } from '@/lib/mutations';
import { playerCreateSchema } from '@/lib/validators';

export const dynamic = 'force-dynamic';

/** POST /api/admin/players — cria um jogador e busca os dados do Roblox. */
export const POST = adminRoute(async (request, { session }) => {
  const input = await readBody(request, playerCreateSchema);
  const result = await createPlayer(input, session.user.id);
  return ok(result, undefined, { status: 201 });
});
