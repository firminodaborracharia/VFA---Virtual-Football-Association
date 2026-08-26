import type { Metadata } from 'next';

import { MatchesManager } from '@/components/admin/matches-manager';
import { getActiveSeason, listClubs, listCompetitions, listMatches, listPlayers } from '@/lib/queries';
import { requireAdmin } from '@/lib/rbac';

export const dynamic = 'force-dynamic';

export const metadata: Metadata = { title: 'Partidas' };

export default async function AdminMatchesPage() {
  // Checagem obrigatória ANTES de qualquer consulta ao banco.
  //
  // No App Router o `layout` e a `page` renderizam em paralelo: se a proteção
  // ficasse só no layout, os dados desta página já teriam sido buscados e
  // transmitidos no HTML antes de o redirect do layout acontecer. Aqui a
  // função lança o redirect antes de qualquer query, então nada vaza.
  await requireAdmin();

  const season = await getActiveSeason();

  const [{ rows: matches }, clubs, competitions, { rows: players }] = await Promise.all([
    listMatches({ seasonId: season?.id, limit: 300, order: 'desc' }),
    listClubs(),
    season ? listCompetitions(season.id) : Promise.resolve([]),
    listPlayers({ limit: 500 }),
  ]);

  return (
    <MatchesManager
      matches={matches.map((match) => ({
        id: match.id,
        kickoffAt: match.kickoffAt,
        status: match.status,
        homeScore: match.homeScore,
        awayScore: match.awayScore,
        homePenalties: match.homePenalties,
        awayPenalties: match.awayPenalties,
        matchday: match.matchday,
        venue: match.venue,
        competitionId: match.competitionId,
        competitionName: match.competitionName,
        roundName: match.roundName,
        homeId: match.homeId,
        homeName: match.homeName,
        homeAbbr: match.homeAbbr,
        homeLogo: match.homeLogo,
        awayId: match.awayId,
        awayName: match.awayName,
        awayAbbr: match.awayAbbr,
        awayLogo: match.awayLogo,
      }))}
      clubs={clubs.map((club) => ({
        id: club.id,
        name: club.name,
        abbreviation: club.abbreviation,
        logoUrl: club.logoUrl,
      }))}
      competitions={competitions.map((competition) => ({
        id: competition.id,
        name: competition.name,
      }))}
      players={players.map((player) => ({
        id: player.id,
        displayName: player.displayName,
        clubId: player.clubId,
        shirtNumber: player.shirtNumber,
      }))}
    />
  );
}
