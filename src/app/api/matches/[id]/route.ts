import { notFoundResponse, ok, route } from '@/lib/api';
import { getMatchAppearances, getMatchById, getMatchEvents } from '@/lib/queries';

export const dynamic = 'force-dynamic';

export const GET = route(async (_request, context) => {
  const { id } = await context.params;

  const match = await getMatchById(id);
  if (!match) return notFoundResponse('Partida');

  const [events, appearances] = await Promise.all([getMatchEvents(id), getMatchAppearances(id)]);
  return ok({ match, events, appearances });
});
