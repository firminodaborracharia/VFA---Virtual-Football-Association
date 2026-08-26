import { adminRoute, ok, readBody } from '@/lib/api';
import { audit } from '@/lib/mutations';
import { getSettings, updateSetting } from '@/lib/settings';
import { settingUpdateSchema } from '@/lib/validators';

export const dynamic = 'force-dynamic';

export const GET = adminRoute(async () => ok(await getSettings()));

/** PUT /api/admin/settings — identidade visual, dados do site e Roblox. */
export const PUT = adminRoute(async (request, { session }) => {
  const input = await readBody(request, settingUpdateSchema);
  const value = await updateSetting(input.key, input.value);
  await audit(session.user.id, 'update', 'settings', input.key, value);
  return ok(value);
});
