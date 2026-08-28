import { CalendarDays, Crown, MapPin, Users } from 'lucide-react';
import type { Metadata } from 'next';
import Link from 'next/link';
import { notFound } from 'next/navigation';

import { ClubCrest, PlayerAvatar } from '@/components/common/remote-image';
import { MatchRowItem } from '@/components/domain/match-card';
import { StandingsTable } from '@/components/domain/standings-table';
import { Badge } from '@/components/ui/badge';
import { Card, StatTile } from '@/components/ui/card';
import { EmptyState } from '@/components/ui/empty-state';
import { Tabs } from '@/components/ui/tabs';
import { parseConfig } from '@/lib/engine/config';
import {
  getActiveSeason,
  getClubBySlug,
  getClubCompetitions,
  getClubSeasonTotals,
  getClubSquad,
  getLeagueCompetition,
  getQualificationZones,
  getStandings,
  listMatches,
} from '@/lib/queries';
import { efficiency, formatDate, formatDiff, POSITION_LABELS, POSITION_SHORT } from '@/lib/utils';

export const dynamic = 'force-dynamic';

export async function generateMetadata({
  params,
}: {
  params: Promise<{ slug: string }>;
}): Promise<Metadata> {
  const { slug } = await params;
  const club = await getClubBySlug(slug);
  if (!club) return { title: 'Clube não encontrado' };

  return {
    title: club.name,
    description: `Elenco, partidas, tabela e estatísticas do ${club.name} na ${club.leagueName}.`,
  };
}

export default async function ClubPage({ params }: { params: Promise<{ slug: string }> }) {
  const { slug } = await params;
  const [club, season] = await Promise.all([getClubBySlug(slug), getActiveSeason()]);

  if (!club) notFound();

  const [squad, competitions, totals, recent, upcoming] = await Promise.all([
    getClubSquad(club.id),
    season ? getClubCompetitions(club.id, season.id) : Promise.resolve([]),
    season
      ? getClubSeasonTotals(club.id, season.id)
      : Promise.resolve({
          played: 0,
          won: 0,
          drawn: 0,
          lost: 0,
          goalsFor: 0,
          goalsAgainst: 0,
          points: 0,
        }),
    listMatches({ clubId: club.id, seasonId: season?.id, status: 'FINISHED', limit: 8, order: 'desc' }),
    listMatches({
      clubId: club.id,
      seasonId: season?.id,
      status: 'SCHEDULED',
      from: new Date(),
      limit: 8,
      order: 'asc',
    }),
  ]);

  const leagueCompetition = season ? await getLeagueCompetition(club.leagueId, season.id) : null;
  const [standings, zones] = await Promise.all([
    leagueCompetition ? getStandings(leagueCompetition.id) : Promise.resolve([]),
    getQualificationZones(club.leagueId),
  ]);

  const ownRow = standings.find((row) => row.club.id === club.id) ?? null;
  const captain = squad.find((player) => player.id === club.captainId) ?? null;
  const goalDiff = totals.goalsFor - totals.goalsAgainst;

  return (
    <>
      {/* ══════════ CABEÇALHO ══════════ */}
      <header
        className="relative overflow-hidden border-b border-line"
        style={{
          backgroundImage: `radial-gradient(ellipse 55% 130% at 10% 0%, ${club.primaryColor}2e, transparent 70%)`,
        }}
      >
        <div className="container-vfa py-10 sm:py-14">
          <div className="flex flex-col gap-6 sm:flex-row sm:items-center">
            <ClubCrest club={club} size={112} priority className="rounded-2xl" />

            <div className="min-w-0 flex-1">
              <div className="flex flex-wrap items-center gap-2">
                <Link href={`/competicoes?liga=${club.leagueSlug}`}>
                  <Badge tone="accent">{club.leagueName}</Badge>
                </Link>
                {club.nationFlag ? (
                  <Badge>
                    <span aria-hidden="true">{club.nationFlag}</span>
                    {club.nationName}
                  </Badge>
                ) : null}
                {ownRow ? <Badge>{ownRow.position}º na tabela</Badge> : null}
              </div>

              <h1 className="animate-fade-up mt-3 text-4xl leading-none font-black tracking-tight sm:text-5xl">
                {club.name}
              </h1>

              <div className="mt-4 flex flex-wrap gap-x-6 gap-y-2 text-sm text-muted">
                {club.ownerName ? (
                  <span className="flex items-center gap-1.5">
                    <Crown className="size-4 text-accent-warm" />
                    Dono: <span className="font-semibold text-fg">{club.ownerName}</span>
                  </span>
                ) : null}
                {captain ? (
                  <Link
                    href={`/jogadores/${captain.slug}`}
                    className="flex items-center gap-1.5 transition-colors hover:text-accent"
                  >
                    <Users className="size-4" />
                    Capitão: <span className="font-semibold text-fg">{captain.displayName}</span>
                  </Link>
                ) : null}
                {club.stadium ? (
                  <span className="flex items-center gap-1.5">
                    <MapPin className="size-4" />
                    {club.stadium}
                  </span>
                ) : null}
                {club.foundedAt ? (
                  <span className="flex items-center gap-1.5">
                    <CalendarDays className="size-4" />
                    Fundado em {formatDate(club.foundedAt)}
                  </span>
                ) : null}
              </div>
            </div>
          </div>
        </div>
      </header>

      <div className="container-vfa space-y-8 py-8">
        {/* ══════════ NÚMEROS ══════════ */}
        <section>
          <h2 className="display-vfa mb-4 text-lg">
            Estatísticas {season ? `— ${season.name}` : ''}
          </h2>
          <div className="grid grid-cols-2 gap-3 sm:grid-cols-4 lg:grid-cols-8">
            <StatTile label="Jogos" value={totals.played} />
            <StatTile label="Vitórias" value={totals.won} />
            <StatTile label="Empates" value={totals.drawn} />
            <StatTile label="Derrotas" value={totals.lost} />
            <StatTile label="Gols pró" value={totals.goalsFor} />
            <StatTile label="Gols contra" value={totals.goalsAgainst} />
            <StatTile label="Saldo" value={formatDiff(goalDiff)} />
            <StatTile
              label="Pontos"
              value={totals.points}
              accent
              hint={`${efficiency(totals.points, totals.played)}%`}
            />
          </div>
        </section>

        {competitions.length > 0 ? (
          <section>
            <h2 className="mb-3 text-sm font-bold tracking-wide text-muted uppercase">
              Competições na temporada
            </h2>
            <div className="flex flex-wrap gap-2">
              {competitions.map((competition) => (
                <Link key={competition.id} href={`/competicoes/${competition.slug}`}>
                  <Badge tone="accent" className="cursor-pointer hover:brightness-125">
                    {competition.name}
                  </Badge>
                </Link>
              ))}
            </div>
          </section>
        ) : null}

        {/* ══════════ ABAS ══════════ */}
        <Tabs
          items={[
            {
              id: 'elenco',
              label: 'Elenco',
              count: squad.length,
              content:
                squad.length === 0 ? (
                  <EmptyState
                    title="Elenco vazio"
                    description="Nenhum jogador está vinculado a este clube no momento."
                  />
                ) : (
                  <div className="stagger grid grid-cols-1 gap-3 sm:grid-cols-2 lg:grid-cols-3">
                    {squad.map((player) => (
                      <Link
                        key={player.id}
                        href={`/jogadores/${player.slug}`}
                        className="group flex items-center gap-3 rounded-xl border border-line bg-surface p-3 transition-all hover:border-accent/40 hover:shadow-card"
                      >
                        <PlayerAvatar player={player} size={40} />
                        <div className="min-w-0 flex-1">
                          <p className="truncate font-semibold transition-colors group-hover:text-accent">
                            {player.displayName}
                          </p>
                          <p className="truncate text-xs text-subtle">
                            {POSITION_LABELS[player.position]}
                            {player.nationFlag ? ` · ${player.nationFlag}` : ''}
                            {player.id === club.captainId ? ' · Capitão' : ''}
                          </p>
                        </div>
                        {player.shirtNumber ? (
                          <span className="shrink-0 font-mono text-lg font-black text-surface-3 transition-colors group-hover:text-accent/40">
                            {player.shirtNumber}
                          </span>
                        ) : (
                          <span className="shrink-0 text-[0.65rem] font-bold text-subtle">
                            {POSITION_SHORT[player.position]}
                          </span>
                        )}
                      </Link>
                    ))}
                  </div>
                ),
            },
            {
              id: 'resultados',
              label: 'Últimas partidas',
              count: recent.rows.length,
              content:
                recent.rows.length === 0 ? (
                  <EmptyState
                    title="Nenhuma partida encerrada"
                    description="Os resultados aparecem aqui assim que forem registrados."
                  />
                ) : (
                  <Card className="divide-y divide-line overflow-hidden">
                    {recent.rows.map((match) => (
                      <MatchRowItem key={match.id} match={match} highlightClubId={club.id} />
                    ))}
                  </Card>
                ),
            },
            {
              id: 'proximas',
              label: 'Próximas partidas',
              count: upcoming.rows.length,
              content:
                upcoming.rows.length === 0 ? (
                  <EmptyState
                    title="Nenhuma partida agendada"
                    description="O calendário do clube aparece aqui quando as próximas rodadas forem marcadas."
                  />
                ) : (
                  <Card className="divide-y divide-line overflow-hidden">
                    {upcoming.rows.map((match) => (
                      <MatchRowItem key={match.id} match={match} highlightClubId={club.id} />
                    ))}
                  </Card>
                ),
            },
            {
              id: 'tabela',
              label: 'Tabela da liga',
              content: (
                <StandingsTable
                  rows={standings}
                  zones={zones}
                  highlightClubId={club.id}
                  pointsPerWin={
                    leagueCompetition ? parseConfig(leagueCompetition.config).points.win : 3
                  }
                />
              ),
            },
          ]}
        />
      </div>
    </>
  );
}
