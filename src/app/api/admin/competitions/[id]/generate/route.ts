import { adminRoute, ok, readBody } from '@/lib/api';
import { db } from '@/db';
import { competitions } from '@/db/schema';
import { eq } from 'drizzle-orm';
import { parseConfig } from '@/lib/engine/config';
import { generateKnockout, generateLeagueFixtures } from '@/lib/engine/generate';
import { audit } from '@/lib/mutations';
import { generateFixturesSchema } from '@/lib/validators';
import { notFoundResponse } from '@/lib/api';

export const dynamic = 'force-dynamic';

/**
 * POST /api/admin/competitions/:id/generate
 *
 * Gera o calendário. O que é gerado depende da configuração da competição:
 * com `knockout.enabled` monta o chaveamento; caso contrário, a tabela de
 * pontos corridos. Passe `?mode=knockout` ou `?mode=league` para forçar.
 */
export const POST = adminRoute(async (request, { params, session }) => {
  const { id } = await params;
  const url = new URL(request.url);
  const mode = url.searchParams.get('mode');

  const [competition] = await db
    .select()
    .from(competitions)
    .where(eq(competitions.id, id))
    .limit(1);

  if (!competition) return notFoundResponse('Competição');

  const input = await readBody(request, generateFixturesSchema);
  const config = parseConfig(competition.config);

  const useKnockout = mode === 'knockout' || (mode !== 'league' && config.knockout.enabled);

  const options = {
    startAt: new Date(input.startAt),
    daysBetweenRounds: input.daysBetweenRounds,
    replaceExisting: input.replaceExisting,
    venue: input.venue,
  };

  const result = useKnockout
    ? await generateKnockout(id, options)
    : await generateLeagueFixtures(id, options);

  await audit(session.user.id, useKnockout ? 'generate-knockout' : 'generate-fixtures', 'competition', id, result);

  return ok(result);
});
