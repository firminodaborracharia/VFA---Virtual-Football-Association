import { Trophy } from 'lucide-react';
import type { Metadata } from 'next';
import Link from 'next/link';
import { notFound } from 'next/navigation';

import { ClubCrest, PlayerAvatar } from '@/components/common/remote-image';
import { Bracket, type BracketRound } from '@/components/domain/bracket';
import { ChampionCelebration } from '@/components/domain/champion-celebration';
import { MatchRowItem } from '@/components/domain/match-card';
import { StandingsTable } from '@/components/domain/standings-table';
import { PageHeader } from '@/components/layout/page-header';
import { Badge } from '@/components/ui/badge';
import { Card, CardHeader } from '@/components/ui/card';
import { EmptyState } from '@/components/ui/empty-state';
import { Tabs } from '@/components/ui/tabs';
import { parseConfig, TIEBREAKER_LABELS } from '@/lib/engine/config';
import { getDictionary } from '@/lib/i18n';
import {
  getCompetitionBySlug,
  getCompetitionMatches,
  getCompetitionRounds,
  getCompetitionTeams,
  getPlayerRanking,
  getQualificationZones,
  getStandings,
  listMatches,
} from '@/lib/queries';
import { COMPETITION_TYPE_LABELS } from '@/lib/utils';

export const dynamic = 'force-dynamic';

export async function generateMetadata({
  params,
}: {
  params: Promise<{ slug: string }>;
}): Promise<Metadata> {
  const { slug } = await params;
  const competition = await getCompetitionBySlug(slug);
  if (!competition) return { title: 'Competição não encontrada' };

  return {
    title: competition.name,
    description: `Tabela, chaveamento, artilharia e partidas da ${competition.name}.`,
  };
}

export default async function CompetitionPage({
  params,
}: {
  params: Promise<{ slug: string }>;
}) {
  const dict = await getDictionary();
  const { slug } = await params;
  const competition = await getCompetitionBySlug(slug);
  if (!competition) notFound();

  const config = parseConfig(competition.config);

  const [teams, rounds, allMatches, standings, zones, scorers, assistants, recent, upcoming] =
    await Promise.all([
      getCompetitionTeams(competition.id),
      getCompetitionRounds(competition.id),
      getCompetitionMatches(competition.id),
      getStandings(competition.id),
      competition.leagueId ? getQualificationZones(competition.leagueId) : Promise.resolve([]),
      getPlayerRanking('goals', {
        seasonId: competition.seasonId,
        competitionId: competition.id,
        limit: 10,
      }),
      getPlayerRanking('assists', {
        seasonId: competition.seasonId,
        competitionId: competition.id,
        limit: 10,
      }),
      listMatches({ competitionId: competition.id, status: 'FINISHED', limit: 10, order: 'desc' }),
      listMatches({
        competitionId: competition.id,
        status: 'SCHEDULED',
        limit: 10,
        order: 'asc',
      }),
    ]);

  const champion = competition.championClubId
    ? (teams.find((team) => team.clubId === competition.championClubId) ?? null)
    : null;

  // ── Chaveamento ──
  const knockoutRounds = rounds.filter((round) => round.type === 'KNOCKOUT');
  const bracketRounds: BracketRound[] = knockoutRounds.map((round) => ({
    id: round.id,
    name: round.name,
    order: round.order,
    matches: allMatches
      .filter((match) => match.roundId === round.id)
      .sort((a, b) => (a.bracketSlot ?? 0) - (b.bracketSlot ?? 0))
      .map((match) => ({
        id: match.id,
        bracketSlot: match.bracketSlot,
        status: match.status,
        kickoffAt: match.kickoffAt,
        homeScore: match.homeScore,
        awayScore: match.awayScore,
        homePenalties: match.homePenalties,
        awayPenalties: match.awayPenalties,
        home: {
          id: match.homeId,
          name: match.homeName,
          shortName: match.homeShort,
          abbreviation: match.homeAbbr,
          logoUrl: match.homeLogo,
        },
        away: {
          id: match.awayId,
          name: match.awayName,
          shortName: match.awayShort,
          abbreviation: match.awayAbbr,
          logoUrl: match.awayLogo,
        },
      })),
  }));

  const isIntercontinental = competition.type === 'INTERCONTINENTAL';

  const tabs = [];

  // O chaveamento vem primeiro quando existe: numa competição de mata-mata é
  // ele que o torcedor quer ver, não uma tabela.
  if (bracketRounds.length > 0) {
    tabs.push({
      id: 'chaveamento',
      label: 'Chaveamento',
      content: <Bracket rounds={bracketRounds} />,
    });
  }

  // A tabela só aparece quando existe fase de pontos corridos de verdade.
  // Numa competição puramente eliminatória, todas as linhas seriam zero — e
  // uma tabela zerada não informa nada, só confunde.
  const hasLeaguePhase = standings.some((row) => row.played > 0);

  if (hasLeaguePhase && !isIntercontinental) {
    tabs.push({
      id: 'tabela',
      label: 'Classificação',
      content: (
        <div className="space-y-3">
          <StandingsTable rows={standings} zones={zones} pointsPerWin={config.points.win} dict={dict} />
          <p className="text-xs text-subtle">
            Pontuação: vitória {config.points.win}, empate {config.points.draw}, derrota{' '}
            {config.points.loss}. Desempate:{' '}
            {config.tiebreakers
              .map((criterion) => TIEBREAKER_LABELS[criterion].toLowerCase())
              .join(' → ')}
            .
          </p>
        </div>
      ),
    });
  }

  tabs.push({
    id: 'partidas',
    label: 'Partidas',
    count: recent.rows.length + upcoming.rows.length,
    content: (
      <div className="grid gap-5 lg:grid-cols-2">
        <div>
          <h3 className="mb-3 text-sm font-bold tracking-wide text-muted uppercase">
            Próximas partidas
          </h3>
          {upcoming.rows.length === 0 ? (
            <EmptyState title="Nenhuma partida agendada" className="py-8" />
          ) : (
            <Card className="divide-y divide-line overflow-hidden">
              {upcoming.rows.map((match) => (
                <MatchRowItem key={match.id} match={match} showCompetition={false} />
              ))}
            </Card>
          )}
        </div>
        <div>
          <h3 className="mb-3 text-sm font-bold tracking-wide text-muted uppercase">
            Últimos resultados
          </h3>
          {recent.rows.length === 0 ? (
            <EmptyState title="Nenhum resultado registrado" className="py-8" />
          ) : (
            <Card className="divide-y divide-line overflow-hidden">
              {recent.rows.map((match) => (
                <MatchRowItem key={match.id} match={match} showCompetition={false} />
              ))}
            </Card>
          )}
        </div>
      </div>
    ),
  });

  tabs.push({
    id: 'artilharia',
    label: 'Artilharia',
    content: (
      <div className="grid gap-5 lg:grid-cols-2">
        <RankingCard title="Artilheiros" metric="goals" rows={scorers} />
        <RankingCard title="Assistências" metric="assists" rows={assistants} />
      </div>
    ),
  });

  tabs.push({
    id: 'participantes',
    label: 'Participantes',
    count: teams.length,
    content:
      teams.length === 0 ? (
        <EmptyState
          title="Nenhum clube definido"
          description="Os participantes são definidos no painel administrativo."
        />
      ) : (
        <div className="stagger grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
          {teams.map((team) => (
            <Link
              key={team.id}
              href={`/clubes/${team.clubSlug}`}
              className="group flex items-center gap-3 rounded-xl border border-line bg-surface p-3 transition-all hover:border-accent/40"
            >
              <ClubCrest
                club={{ name: team.clubName, abbreviation: team.clubAbbr, logoUrl: team.clubLogo }}
                size={36}
              />
              <div className="min-w-0 flex-1">
                <p className="truncate font-semibold transition-colors group-hover:text-accent">
                  {team.clubName}
                </p>
                <p className="truncate text-xs text-subtle">
                  {team.nationFlag ? `${team.nationFlag} ` : ''}
                  {team.leagueName}
                </p>
              </div>
              {team.groupName ? <Badge>Grupo {team.groupName}</Badge> : null}
              {team.seed ? (
                <span className="font-mono text-xs text-subtle">#{team.seed}</span>
              ) : null}
            </Link>
          ))}
        </div>
      ),
  });

  return (
    <>
      <PageHeader
        eyebrow={COMPETITION_TYPE_LABELS[competition.type]}
        title={competition.name}
        accent={competition.accent}
        description={
          isIntercontinental
            ? 'Decisão entre os campeões da Libertadores e da Champions League da VFA.'
            : `${teams.length} ${teams.length === 1 ? 'clube participante' : 'clubes participantes'}.`
        }
        media={
          <div
            className="flex size-16 shrink-0 items-center justify-center rounded-2xl text-xl font-black sm:size-20"
            style={{
              backgroundColor: `${competition.accent ?? '#00e08f'}1a`,
              color: competition.accent ?? 'var(--vfa-accent)',
            }}
          >
            {(competition.shortName ?? competition.name).slice(0, 2).toUpperCase()}
          </div>
        }
      />

      <div className="container-vfa space-y-8 py-8">
        {champion ? (
          <ChampionCelebration
            champion={{
              name: champion.clubName,
              abbreviation: champion.clubAbbr,
              logoUrl: champion.clubLogo,
              slug: champion.clubSlug,
              leagueName: champion.leagueName,
              nationFlag: champion.nationFlag,
            }}
            title={
              isIntercontinental
                ? 'Campeão Intercontinental da VFA'
                : `Campeão · ${competition.name}`
            }
            accent={competition.accent ?? '#ffb703'}
          />
        ) : null}

        {isIntercontinental && !champion ? (
          <IntercontinentalPreview matches={allMatches} />
        ) : null}

        <Tabs items={tabs} />
      </div>
    </>
  );
}

function RankingCard({
  title,
  metric,
  rows,
}: {
  title: string;
  metric: 'goals' | 'assists';
  rows: Awaited<ReturnType<typeof getPlayerRanking>>;
}) {
  return (
    <Card>
      <CardHeader title={title} icon={<Trophy className="size-4" />} />
      {rows.length === 0 ? (
        <div className="p-5 text-sm text-muted">Nenhum registro ainda.</div>
      ) : (
        <ol className="divide-y divide-line">
          {rows.map((row, index) => (
            <li key={row.playerId}>
              <Link
                href={`/jogadores/${row.playerSlug}`}
                className="flex items-center gap-3 px-4 py-2.5 transition-colors hover:bg-surface-2"
              >
                <span className="w-5 shrink-0 text-center font-mono text-sm font-bold text-subtle tabular-nums">
                  {index + 1}
                </span>
                <PlayerAvatar
                  player={{
                    displayName: row.playerName,
                    robloxHeadshotUrl: row.robloxHeadshotUrl,
                    robloxAvatarUrl: row.robloxAvatarUrl,
                  }}
                  size={30}
                />
                <span className="min-w-0 flex-1">
                  <span className="block truncate text-sm font-semibold">{row.playerName}</span>
                  <span className="block truncate text-xs text-subtle">
                    {row.nationFlag ? `${row.nationFlag} ` : ''}
                    {row.clubName ?? 'sem clube'}
                  </span>
                </span>
                <span className="shrink-0 font-mono text-lg font-black text-accent tabular-nums">
                  {metric === 'goals' ? row.goals : row.assists}
                </span>
              </Link>
            </li>
          ))}
        </ol>
      )}
    </Card>
  );
}

/** Cartaz da final intercontinental antes de o campeão ser definido. */
function IntercontinentalPreview({
  matches,
}: {
  matches: Awaited<ReturnType<typeof getCompetitionMatches>>;
}) {
  const final = matches[0];
  if (!final) {
    return (
      <EmptyState
        icon={<Trophy className="size-6" />}
        title="A final ainda não foi definida"
        description="O confronto aparece aqui quando os campeões da Libertadores e da Champions League forem conhecidos."
      />
    );
  }

  return (
    <div className="overflow-hidden rounded-3xl border border-accent-warm/30 bg-gradient-to-b from-accent-warm/5 to-transparent p-8 text-center sm:p-12">
      <p className="text-xs font-black tracking-[0.3em] text-accent-warm uppercase">
        Final Intercontinental
      </p>

      <div className="mt-8 flex items-center justify-center gap-6 sm:gap-12">
        <Link href={`/clubes/${final.homeSlug}`} className="flex flex-col items-center gap-3">
          <ClubCrest
            club={{ name: final.homeName, abbreviation: final.homeAbbr, logoUrl: final.homeLogo }}
            size={80}
            className="rounded-2xl"
          />
          <span className="text-sm font-bold sm:text-lg">{final.homeShort}</span>
        </Link>

        <span className="font-mono text-2xl font-black text-line-strong sm:text-4xl">×</span>

        <Link href={`/clubes/${final.awaySlug}`} className="flex flex-col items-center gap-3">
          <ClubCrest
            club={{ name: final.awayName, abbreviation: final.awayAbbr, logoUrl: final.awayLogo }}
            size={80}
            className="rounded-2xl"
          />
          <span className="text-sm font-bold sm:text-lg">{final.awayShort}</span>
        </Link>
      </div>

      <Link
        href={`/partidas/${final.id}`}
        className="mt-8 inline-block rounded-xl border border-accent-warm/40 px-4 py-2 text-sm font-semibold text-accent-warm transition-colors hover:bg-accent-warm/10"
      >
        Ver detalhes da partida
      </Link>
    </div>
  );
}
