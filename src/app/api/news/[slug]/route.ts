import { notFoundResponse, ok, route } from '@/lib/api';
import { getNewsBySlug } from '@/lib/queries';

export const dynamic = 'force-dynamic';

export const GET = route(async (_request, context) => {
  const { slug } = await context.params;

  const article = await getNewsBySlug(slug);

  // A API pública só devolve matéria publicada — rascunho não vaza por aqui.
  const isPublished =
    article?.status === 'PUBLISHED' && article.publishedAt && article.publishedAt <= new Date();

  if (!article || !isPublished) return notFoundResponse('Notícia');

  return ok(article);
});
