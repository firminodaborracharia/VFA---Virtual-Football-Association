import { eq } from 'drizzle-orm';

import { db } from '@/db';
import { competitions } from '@/db/schema';
import { adminRoute, fail, notFoundResponse, ok } from '@/lib/api';
import { populateContinental, populateIntercontinental } from '@/lib/engine/generate';
import { audit } from '@/lib/mutations';

export const dynamic = 'force-dynamic';

/**
 * POST /api/admin/competitions/:id/populate
 *
 * Preenche os participantes automaticamente:
 *  • CONTINENTAL      → clubes nas zonas de classificação que apontam para cá;
 *  • INTERCONTINENTAL → campeões das competições listadas em `parentSlug`
 *                       (separadas por vírgula).
 */
export const POST = adminRoute(async (_request, { params, session }) => {
  const { id } = await params;

  const [competition] = await db
    .select()
    .from(competitions)
    .where(eq(competitions.id, id))
    .limit(1);

  if (!competition) return notFoundResponse('Competição');

  if (competition.type === 'INTERCONTINENTAL') {
    const slugs = (competition.parentSlug ?? '')
      .split(',')
      .map((slug) => slug.trim())
      .filter(Boolean);

    if (slugs.length < 2) {
      return fail(
        'Informe as duas competições de origem no campo "Competição pai", separadas por vírgula. Ex.: vfa-libertadores,vfa-champions-league',
        422,
      );
    }

    const result = await populateIntercontinental(id, slugs);
    await audit(session.user.id, 'populate', 'competition', id, result);
    return ok(result);
  }

  const result = await populateContinental(id);
  await audit(session.user.id, 'populate', 'competition', id, result);
  return ok(result);
});
