import type { Metadata } from 'next';

import { SettingsManager } from '@/components/admin/settings-manager';
import { getSettings } from '@/lib/settings';
import { requireAdmin } from '@/lib/rbac';

export const dynamic = 'force-dynamic';

export const metadata: Metadata = { title: 'Configurações' };

export default async function AdminSettingsPage() {
  // Checagem obrigatória ANTES de qualquer consulta ao banco.
  //
  // No App Router o `layout` e a `page` renderizam em paralelo: se a proteção
  // ficasse só no layout, os dados desta página já teriam sido buscados e
  // transmitidos no HTML antes de o redirect do layout acontecer. Aqui a
  // função lança o redirect antes de qualquer query, então nada vaza.
  await requireAdmin();

  const settings = await getSettings();
  return <SettingsManager settings={settings} />;
}
