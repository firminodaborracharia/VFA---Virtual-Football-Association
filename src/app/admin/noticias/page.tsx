import type { Metadata } from 'next';

import { NewsManager } from '@/components/admin/news-manager';
import { publishScheduledNews } from '@/lib/mutations';
import { listNewsAdmin, listNewsCategories } from '@/lib/queries';
import { requireAdmin } from '@/lib/rbac';

export const dynamic = 'force-dynamic';

export const metadata: Metadata = { title: 'Notícias' };

export default async function AdminNewsPage() {
  // Checagem obrigatória ANTES de qualquer consulta ao banco.
  //
  // No App Router o `layout` e a `page` renderizam em paralelo: se a proteção
  // ficasse só no layout, os dados desta página já teriam sido buscados e
  // transmitidos no HTML antes de o redirect do layout acontecer. Aqui a
  // função lança o redirect antes de qualquer query, então nada vaza.
  await requireAdmin();

  // Publica o que já venceu antes de listar, para o painel não mostrar como
  // "agendada" uma matéria cuja hora já passou.
  await publishScheduledNews().catch(() => 0);

  const [articles, categories] = await Promise.all([listNewsAdmin(), listNewsCategories()]);

  return (
    <NewsManager
      articles={articles}
      categories={categories.map((category) => ({ id: category.id, name: category.name }))}
    />
  );
}
