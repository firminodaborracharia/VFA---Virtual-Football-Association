import { adminRoute, ok } from '@/lib/api';
import { activateSeason } from '@/lib/mutations';

export const dynamic = 'force-dynamic';

export const POST = adminRoute(async (_request, { params, session }) => {
  const { id } = await params;
  await activateSeason(id, session.user.id);
  return ok({ activated: true });
});
