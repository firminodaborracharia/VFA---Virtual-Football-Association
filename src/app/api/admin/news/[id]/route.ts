import { adminRoute, ok, readBody } from '@/lib/api';
import { deleteNews, updateNews } from '@/lib/mutations';
import { newsSchema } from '@/lib/validators';

export const dynamic = 'force-dynamic';

export const PATCH = adminRoute(async (request, { params, session }) => {
  const { id } = await params;
  const input = await readBody(request, newsSchema);
  return ok(await updateNews(id, input, session.user.id));
});

export const DELETE = adminRoute(async (_request, { params, session }) => {
  const { id } = await params;
  await deleteNews(id, session.user.id);
  return ok({ deleted: true });
});
