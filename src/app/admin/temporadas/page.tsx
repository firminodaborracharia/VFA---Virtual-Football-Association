import type { Metadata } from 'next';

import { SeasonsManager } from '@/components/admin/seasons-manager';
import { listSeasons } from '@/lib/queries';
import { requireAdmin } from '@/lib/rbac';

export const dynamic = 'force-dynamic';

export const metadata: Metadata = { title: 'Temporadas' };

export default async function AdminSeasonsPage() {
  // Checagem obrigatória ANTES de qualquer consulta ao banco.
  //
  // No App Router o `layout` e a `page` renderizam em paralelo: se a proteção
  // ficasse só no layout, os dados desta página já teriam sido buscados e
  // transmitidos no HTML antes de o redirect do layout acontecer. Aqui a
  // função lança o redirect antes de qualquer query, então nada vaza.
  await requireAdmin();

  const seasons = await listSeasons();
  return <SeasonsManager seasons={seasons} />;
}
