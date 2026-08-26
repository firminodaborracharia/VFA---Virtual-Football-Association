import { adminRoute, ok } from '@/lib/api';
import { syncPlayerRoblox } from '@/lib/roblox/sync';

export const dynamic = 'force-dynamic';

/**
 * POST /api/admin/players/:id/roblox
 * Botão "Atualizar dados Roblox" — ignora o TTL do cache.
 */
export const POST = adminRoute(async (_request, { params }) => {
  const { id } = await params;
  return ok(await syncPlayerRoblox(id, true));
});
