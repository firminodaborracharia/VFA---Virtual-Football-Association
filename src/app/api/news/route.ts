import { ok, paginationMeta, readPagination, route } from '@/lib/api';
import { listNews } from '@/lib/queries';

export const dynamic = 'force-dynamic';

export const GET = route(async (request) => {
  const url = new URL(request.url);
  const pagination = readPagination(request, 12, 50);

  const { rows, total } = await listNews({
    limit: pagination.perPage,
    offset: pagination.offset,
    categorySlug: url.searchParams.get('category') ?? undefined,
  });

  return ok(rows, paginationMeta(pagination, total));
});
