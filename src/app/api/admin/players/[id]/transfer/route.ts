import { adminRoute, ok, readBody } from '@/lib/api';
import { getActiveSeasonOrThrow, transferPlayer } from '@/lib/mutations';
import { transferSchema } from '@/lib/validators';

export const dynamic = 'force-dynamic';

/** POST /api/admin/players/:id/transfer — item 22 do escopo. */
export const POST = adminRoute(async (request, { params, session }) => {
  const { id } = await params;
  const input = await readBody(request, transferSchema.partial({ playerId: true, seasonId: true }));

  const seasonId = input.seasonId ?? (await getActiveSeasonOrThrow()).id;

  await transferPlayer(
    {
      playerId: id,
      toClubId: input.toClubId ?? null,
      seasonId,
      type: input.type ?? 'TRANSFER',
      occurredAt: input.occurredAt,
      note: input.note ?? null,
    },
    session.user.id,
  );

  return ok({ transferred: true });
});
