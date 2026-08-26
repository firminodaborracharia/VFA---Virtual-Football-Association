import { adminRoute, ok, readBody } from '@/lib/api';
import { createNews } from '@/lib/mutations';
import { newsSchema } from '@/lib/validators';

export const dynamic = 'force-dynamic';

export const POST = adminRoute(async (request, { session }) => {
  const input = await readBody(request, newsSchema);
  return ok(await createNews(input, session.user.id), undefined, { status: 201 });
});
