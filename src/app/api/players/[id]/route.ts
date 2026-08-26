import { notFoundResponse, ok, route } from '@/lib/api';
import { getActiveSeason, getPlayerBySlug, getPlayerHistory, getPlayerStats } from '@/lib/queries';

export const dynamic = 'force-dynamic';

/**
 * GET /api/players/:id — aceita o slug ou o id do jogador.
 * Devolve perfil, estatísticas da temporada ativa e histórico.
 */
export const GET = route(async (_request, context) => {
  const { id } = await context.params;

  const player = await getPlayerBySlug(id);
  if (!player) return notFoundResponse('Jogador');

  const season = await getActiveSeason();
  const [stats, history] = await Promise.all([
    getPlayerStats(player.id, season?.id),
    getPlayerHistory(player.id),
  ]);

  return ok({ player, stats, history });
});
