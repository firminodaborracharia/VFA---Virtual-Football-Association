import { ArrowLeft } from 'lucide-react';
import type { Metadata } from 'next';
import Link from 'next/link';
import { notFound } from 'next/navigation';

import { NewsCard } from '@/components/domain/cards';
import { getNewsBySlug, listNews } from '@/lib/queries';
import { isAdmin, getSession } from '@/lib/rbac';
import { sanitizeNewsHtml } from '@/lib/sanitize';
import { formatLongDate } from '@/lib/utils';

export const dynamic = 'force-dynamic';

export async function generateMetadata({
  params,
}: {
  params: Promise<{ slug: string }>;
}): Promise<Metadata> {
  const { slug } = await params;
  const article = await getNewsBySlug(slug);
  if (!article) return { title: 'Notícia não encontrada' };

  return {
    title: article.title,
    description: article.excerpt ?? article.subtitle ?? undefined,
    openGraph: {
      title: article.title,
      description: article.excerpt ?? article.subtitle ?? undefined,
      images: article.coverImageUrl ? [article.coverImageUrl] : undefined,
      type: 'article',
    },
  };
}

export default async function NewsArticlePage({
  params,
}: {
  params: Promise<{ slug: string }>;
}) {
  const { slug } = await params;
  const [article, session] = await Promise.all([getNewsBySlug(slug), getSession()]);

  if (!article) notFound();

  const isPublished =
    article.status === 'PUBLISHED' && article.publishedAt && article.publishedAt <= new Date();

  // Rascunhos e agendadas só são visíveis para administradores, que veem um
  // aviso claro de que a matéria ainda não está no ar.
  if (!isPublished && !isAdmin(session)) notFound();

  const [related] = await Promise.all([listNews({ limit: 4 })]);
  const others = related.rows.filter((item) => item.slug !== article.slug).slice(0, 3);

  // Sanitizamos de novo na leitura. O conteúdo já é sanitizado ao gravar; esta
  // é a segunda barreira, para o caso de um registro ter entrado por fora.
  const safeHtml = sanitizeNewsHtml(article.content);

  return (
    <article>
      <header className="border-b border-line">
        <div className="container-vfa max-w-3xl py-10 sm:py-14">
          <Link
            href="/noticias"
            className="mb-6 inline-flex items-center gap-1.5 text-sm font-semibold text-muted transition-colors hover:text-accent"
          >
            <ArrowLeft className="size-4" />
            VFA News
          </Link>

          {!isPublished ? (
            <p className="mb-5 rounded-xl border border-accent-warm/40 bg-accent-warm/5 px-4 py-2.5 text-sm text-accent-warm">
              Pré-visualização de administrador: esta matéria ainda não está publicada
              {article.status === 'SCHEDULED' ? ' (agendada)' : ' (rascunho)'}.
            </p>
          ) : null}

          {article.categoryName ? (
            <span
              className="inline-block rounded-full px-3 py-1 text-[0.7rem] font-bold tracking-wide text-black uppercase"
              style={{ backgroundColor: article.categoryColor ?? '#e5e7eb' }}
            >
              {article.categoryName}
            </span>
          ) : null}

          <h1 className="animate-fade-up mt-4 text-3xl leading-tight font-black tracking-tight sm:text-5xl">
            {article.title}
          </h1>

          {article.subtitle ? (
            <p className="mt-4 text-lg leading-relaxed text-muted">{article.subtitle}</p>
          ) : null}

          <p className="mt-6 text-sm text-subtle">{formatLongDate(article.publishedAt)}</p>
        </div>
      </header>

      {article.coverImageUrl ? (
        <div className="container-vfa max-w-4xl pt-8">
          {/* eslint-disable-next-line @next/next/no-img-element */}
          <img
            src={article.coverImageUrl}
            alt=""
            className="w-full rounded-2xl border border-line object-cover"
          />
        </div>
      ) : null}

      <div className="container-vfa max-w-3xl py-10">
        {/* O HTML foi sanitizado no servidor (src/lib/sanitize.ts): sem script,
            sem handlers inline, sem esquemas perigosos em href/src. */}
        <div className="prose-vfa" dangerouslySetInnerHTML={{ __html: safeHtml }} />
      </div>

      {others.length > 0 ? (
        <section className="container-vfa border-t border-line py-10">
          <h2 className="mb-5 text-lg font-black tracking-tight">Leia também</h2>
          <div className="stagger grid gap-5 sm:grid-cols-3">
            {others.map((item) => (
              <NewsCard key={item.id} article={item} />
            ))}
          </div>
        </section>
      ) : null}
    </article>
  );
}
