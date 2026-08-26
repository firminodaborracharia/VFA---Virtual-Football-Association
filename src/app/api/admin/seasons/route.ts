import { adminRoute, ok, readBody } from '@/lib/api';
import { createSeason } from '@/lib/mutations';
import { seasonSchema } from '@/lib/validators';

export const dynamic = 'force-dynamic';

export const POST = adminRoute(async (request, { session }) => {
  const input = await readBody(request, seasonSchema);
  return ok(
    await createSeason(
      {
        year: input.year,
        name: input.name,
        tagline: input.tagline,
        bannerUrl: input.bannerUrl,
        startDate: input.startDate,
        endDate: input.endDate,
      },
      session.user.id,
    ),
    undefined,
    { status: 201 },
  );
});
