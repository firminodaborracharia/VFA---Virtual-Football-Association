import { ExternalLink, ShieldCheck } from 'lucide-react';
import type { Metadata } from 'next';
import Link from 'next/link';
import { notFound } from 'next/navigation';

import { ClubCrest, PlayerAvatar } from '@/components/common/remote-image';
import { MatchRowItem } from '@/components/domain/match-card';
import { PlayerCharts } from '@/components/domain/player-charts';
import { RobloxRefreshButton } from '@/components/domain/roblox-refresh-button';
import { Badge } from '@/components/ui/badge';
import { ButtonLink } from '@/components/ui/button';
import { Card, CardHeader, StatTile } from '@/components/ui/card';
import { EmptyState } from '@/components/ui/empty-state';
import { Tabs } from '@/components/ui/tabs';
import { profileUrl } from '@/lib/roblox/service';
import {
  getActiveSeason,
  getPlayerBySlug,
  getPlayerHistory,
  getPlayerStats,
  getPlayerTimeline,
  listMatches,
} from '@/lib/queries';
import { isAdmin, getSession } from '@/lib/rbac';
import {
  efficiency,
  formatDate,
  POSITION_LABELS,
  TRANSFER_TYPE_LABELS,
} from '@/lib/utils';

export const dynamic = 'force-dynamic';

export async function generateMetadata({
  params,
}: {
  params: Promise<{ slug: string }>;
}): Promise<Metadata> {
  const { slug } = await params;
  const player = await getPlayerBySlug(slug);
  if (!player) return { title: 'Jogador não encontrado' };

  return {
    title: player.displayName,
    description: `Perfil, estatísticas e histórico de ${player.displayName}${player.clubName ? ` (${player.clubName})` : ''} na VFA.`,
  };
}

export default async function PlayerPage({ params }: { params: Promise<{ slug: string }> }) {
  const { slug } = await params;
  const [player, season, session] = await Promise.all([
    getPlayerBySlug(slug),
    getActiveSeason(),
    getSession(),
  ]);

  if (!player) notFound();

  const admin = isAdmin(session);

  const [stats, history, timeline, recentMatches] = await Promise.all([
    getPlayerStats(player.id, season?.id),
    getPlayerHistory(player.id),
    season ? getPlayerTimeline(player.id, season.id) : Promise.resolve([]),
    player.clubId
      ? listMatches({
          clubId: player.clubId,
          seasonId: season?.id,
          status: 'FINISHED',
          limit: 5,
          order: 'desc',
        })
      : Promise.resolve({ rows: [], total: 0 }),
  ]);

  // Soma das competições da temporada ativa.
  const totals = stats.reduce(
    (acc, row) => ({
      matches: acc.matches + row.matches,
      goals: acc.goals + row.goals,
      assists: acc.assists + row.assists,
      wins: acc.wins + row.wins,
      draws: acc.draws + row.draws,
      losses: acc.losses + row.losses,
      minutes: acc.minutes + row.minutes,
      yellowCards: acc.yellowCards + row.yellowCards,
      redCards: acc.redCards + row.redCards,
    }),
    {
      matches: 0,
      goals: 0,
      assists: 0,
      wins: 0,
      draws: 0,
      losses: 0,
      minutes: 0,
      yellowCards: 0,
      redCards: 0,
    },
  );

  // Aproveitamento no critério de futebol: pontos conquistados / disputados.
  const points = totals.wins * 3 + totals.draws;
  const winRate = efficiency(points, totals.matches, 3);

  return (
    <>
      {/* ══════════ CABEÇALHO DO JOGADOR ══════════ */}
      <header
        className="relative overflow-hidden border-b border-line"
        style={
          player.clubPrimary
            ? {
                backgroundImage: `radial-gradient(ellipse 50% 120% at 12% 0%, ${player.clubPrimary}26, transparent 70%)`,
              }
            : undefined
        }
      >
        <div className="container-vfa py-10 sm:py-14">
          <div className="flex flex-col gap-6 sm:flex-row sm:items-center">
            <PlayerAvatar
              player={player}
              size={128}
              full
              priority
              className="ring-4 ring-line-strong"
            />

            <div className="min-w-0 flex-1">
              <div className="flex flex-wrap items-center gap-2">
                <Badge tone="accent">{POSITION_LABELS[player.position]}</Badge>
                {player.shirtNumber ? <Badge>Camisa {player.shirtNumber}</Badge> : null}
                {player.nationFlag ? (
                  <Badge>
                    <span aria-hidden="true">{player.nationFlag}</span>
                    {player.nationName}
                  </Badge>
                ) : null}
                {!player.isActive ? <Badge tone="warn">Inativo</Badge> : null}
                {player.robloxIsVerified ? (
                  <Badge tone="accent">
                    <ShieldCheck className="size-3" />
                    Verificado no Roblox
                  </Badge>
                ) : null}
              </div>

              <h1 className="animate-fade-up mt-3 text-4xl leading-none font-black tracking-tight sm:text-5xl">
                {player.displayName}
              </h1>

              <p className="mt-2 text-sm text-muted">
                @{player.robloxUsername}
                {player.robloxDisplayName && player.robloxDisplayName !== player.displayName
                  ? ` · ${player.robloxDisplayName} no Roblox`
                  : ''}
              </p>

              <div className="mt-5 flex flex-wrap items-center gap-3">
                {player.clubSlug ? (
                  <Link
                    href={`/clubes/${player.clubSlug}`}
                    className="flex items-center gap-2.5 rounded-xl border border-line bg-surface px-3 py-2 transition-colors hover:border-accent/40"
                  >
                    <ClubCrest
                      club={{
                        name: player.clubName ?? '',
                        abbreviation: player.clubAbbreviation,
                        logoUrl: player.clubLogo,
                      }}
                      size={26}
                    />
                    <span className="text-sm font-semibold">{player.clubName}</span>
                  </Link>
                ) : (
                  <span className="rounded-xl border border-dashed border-line-strong px-3 py-2 text-sm text-subtle">
                    Sem clube no momento
                  </span>
                )}

                {/* Só mostramos o botão quando temos o ID — sem ele, o link
                    levaria para uma página de erro do Roblox. */}
                {player.robloxUserId ? (
                  <ButtonLink
                    href={profileUrl(player.robloxUserId)}
                    target="_blank"
                    rel="noopener noreferrer"
                    variant="outline"
                    size="md"
                  >
                    Ver perfil Roblox
                    <ExternalLink className="size-3.5" />
                  </ButtonLink>
                ) : null}

                {admin ? <RobloxRefreshButton playerId={player.id} size="md" /> : null}
              </div>
            </div>
          </div>
        </div>
      </header>

      <div className="container-vfa space-y-8 py-8">
        {/* ══════════ NÚMEROS DA TEMPORADA ══════════ */}
        <section>
          <h2 className="display-vfa mb-4 text-lg">
            Estatísticas {season ? `— ${season.name}` : ''}
          </h2>

          <div className="grid grid-cols-2 gap-3 sm:grid-cols-3 lg:grid-cols-6">
            <StatTile label="Jogos" value={totals.matches} />
            <StatTile label="Gols" value={totals.goals} accent />
            <StatTile label="Assistências" value={totals.assists} accent />
            <StatTile label="Vitórias" value={totals.wins} />
            <StatTile label="Empates" value={totals.draws} />
            <StatTile label="Derrotas" value={totals.losses} />
          </div>

          <div className="mt-3 grid grid-cols-2 gap-3 sm:grid-cols-4">
            <StatTile
              label="Aproveitamento"
              value={`${winRate}%`}
              hint={`${points} de ${totals.matches * 3} pontos`}
            />
            <StatTile label="Cartões amarelos" value={totals.yellowCards} />
            <StatTile label="Cartões vermelhos" value={totals.redCards} />
            {/*
              Minutos jogados saíram a pedido da VFA. No lugar entra a média de
              gols, que antes só aparecia quando não havia minutos cadastrados
              — ou seja, o quadro mais útil dependia da ausência do outro.
            */}
            <StatTile
              label="Média de gols"
              value={totals.matches > 0 ? (totals.goals / totals.matches).toFixed(2) : '—'}
              hint="por partida"
            />
          </div>
        </section>

        {/* ══════════ ABAS ══════════ */}
        <Tabs
          items={[
            {
              id: 'evolucao',
              label: 'Evolução',
              content: <PlayerCharts timeline={timeline} />,
            },
            {
              id: 'competicoes',
              label: 'Por competição',
              count: stats.length,
              content:
                stats.length === 0 ? (
                  <EmptyState
                    title="Nenhuma estatística nesta temporada"
                    description="Os números aparecem quando o jogador for escalado numa partida encerrada."
                  />
                ) : (
                  <div className="overflow-hidden rounded-2xl border border-line bg-surface">
                    <div className="table-scroll">
                      <table className="w-full min-w-[38rem] text-sm">
                        <thead>
                          <tr className="border-b border-line bg-surface-2 text-[0.7rem] tracking-wider text-subtle uppercase">
                            <th scope="col" className="px-4 py-3 text-left font-semibold">
                              Competição
                            </th>
                            <th scope="col" className="px-3 py-3 text-center font-semibold">J</th>
                            <th scope="col" className="px-3 py-3 text-center font-semibold">G</th>
                            <th scope="col" className="px-3 py-3 text-center font-semibold">A</th>
                            <th scope="col" className="px-3 py-3 text-center font-semibold">V</th>
                            <th scope="col" className="px-3 py-3 text-center font-semibold">E</th>
                            <th scope="col" className="px-3 py-3 text-center font-semibold">D</th>
                            <th scope="col" className="px-3 py-3 text-center font-semibold">CA</th>
                            <th scope="col" className="px-4 py-3 text-center font-semibold">CV</th>
                          </tr>
                        </thead>
                        <tbody className="divide-y divide-line">
                          {stats.map((row) => (
                            <tr key={row.competitionId} className="hover:bg-surface-2">
                              <td className="px-4 py-2.5">
                                <Link
                                  href={`/competicoes/${row.competitionSlug}`}
                                  className="font-semibold transition-colors hover:text-accent"
                                >
                                  {row.competitionName}
                                </Link>
                                <span className="ml-2 text-xs text-subtle">{row.seasonYear}</span>
                              </td>
                              <td className="px-3 py-2.5 text-center font-mono tabular-nums">{row.matches}</td>
                              <td className="px-3 py-2.5 text-center font-mono font-bold text-accent tabular-nums">{row.goals}</td>
                              <td className="px-3 py-2.5 text-center font-mono tabular-nums">{row.assists}</td>
                              <td className="px-3 py-2.5 text-center font-mono tabular-nums text-muted">{row.wins}</td>
                              <td className="px-3 py-2.5 text-center font-mono tabular-nums text-muted">{row.draws}</td>
                              <td className="px-3 py-2.5 text-center font-mono tabular-nums text-muted">{row.losses}</td>
                              <td className="px-3 py-2.5 text-center font-mono tabular-nums text-muted">{row.yellowCards}</td>
                              <td className="px-4 py-2.5 text-center font-mono tabular-nums text-muted">{row.redCards}</td>
                            </tr>
                          ))}
                        </tbody>
                      </table>
                    </div>
                  </div>
                ),
            },
            {
              id: 'historico',
              label: 'Histórico',
              count: history.length,
              content:
                history.length === 0 ? (
                  <EmptyState
                    title="Sem movimentações registradas"
                    description="Transferências e contratações aparecem aqui assim que forem registradas no painel."
                  />
                ) : (
                  <ol className="relative space-y-4 border-l border-line pl-6">
                    {history.map((entry) => (
                      <li key={entry.id} className="relative">
                        <span className="absolute -left-[1.9rem] top-1.5 size-3 rounded-full border-2 border-bg bg-accent" />
                        <div className="rounded-xl border border-line bg-surface p-4">
                          <div className="flex flex-wrap items-center gap-2">
                            <Badge tone="accent">{entry.seasonYear}</Badge>
                            <Badge>{TRANSFER_TYPE_LABELS[entry.type]}</Badge>
                            <span className="text-xs text-subtle">
                              {formatDate(entry.occurredAt)}
                            </span>
                          </div>
                          <p className="mt-2.5 flex flex-wrap items-center gap-2 text-sm">
                            {entry.fromClubName ? (
                              <>
                                <span className="text-muted">{entry.fromClubName}</span>
                                <span className="text-subtle">→</span>
                              </>
                            ) : null}
                            <span className="font-bold text-fg">
                              {entry.toClubName ?? 'Fora da liga'}
                            </span>
                          </p>
                          {entry.note ? (
                            <p className="mt-1.5 text-xs text-muted">{entry.note}</p>
                          ) : null}
                        </div>
                      </li>
                    ))}
                  </ol>
                ),
            },
            {
              id: 'roblox',
              label: 'Perfil Roblox',
              content: <RobloxPanel player={player} />,
            },
          ]}
        />

        {/* ══════════ ÚLTIMAS PARTIDAS DO CLUBE ══════════ */}
        {recentMatches.rows.length > 0 ? (
          <section>
            <h2 className="display-vfa mb-4 text-lg">
              Últimas partidas do {player.clubName}
            </h2>
            <Card className="divide-y divide-line overflow-hidden">
              {recentMatches.rows.map((match) => (
                <MatchRowItem key={match.id} match={match} highlightClubId={player.clubId ?? undefined} />
              ))}
            </Card>
          </section>
        ) : null}
      </div>
    </>
  );
}

/**
 * Painel do Roblox. Cada campo só aparece se a API tiver devolvido o dado —
 * item 3 do escopo: "caso alguma informação não esteja disponível, simplesmente
 * não exibir o campo". Nada de placeholder inventado.
 */
function RobloxPanel({
  player,
}: {
  player: Awaited<ReturnType<typeof getPlayerBySlug>>;
}) {
  if (!player) return null;

  const fields = [
    { label: 'Username', value: player.robloxUsername },
    { label: 'Display Name', value: player.robloxDisplayName },
    { label: 'User ID', value: player.robloxUserId },
    {
      label: 'Conta criada em',
      value: player.robloxCreatedAt ? formatDate(player.robloxCreatedAt) : null,
    },
    {
      label: 'Última sincronização',
      value: player.robloxSyncedAt ? formatDate(player.robloxSyncedAt) : null,
    },
  ].filter((field) => Boolean(field.value));

  return (
    <Card>
      <CardHeader
        title="Dados públicos do Roblox"
        description="Obtidos pela API oficial e armazenados em cache no servidor."
      />
      <div className="p-5">
        {fields.length === 0 ? (
          <p className="text-sm text-muted">
            Ainda não sincronizamos os dados deste jogador com o Roblox.
          </p>
        ) : (
          <dl className="grid gap-x-8 gap-y-3 sm:grid-cols-2">
            {fields.map((field) => (
              <div key={field.label} className="flex justify-between gap-4 border-b border-line pb-2">
                <dt className="text-sm text-muted">{field.label}</dt>
                <dd className="text-right text-sm font-semibold text-fg">{field.value}</dd>
              </div>
            ))}
          </dl>
        )}

        {player.robloxDescription ? (
          <div className="mt-5">
            <p className="text-xs font-bold tracking-wide text-subtle uppercase">
              Descrição do perfil
            </p>
            <p className="mt-1.5 text-sm whitespace-pre-line text-muted">
              {player.robloxDescription}
            </p>
          </div>
        ) : null}

        {player.robloxUserId ? (
          <ButtonLink
            href={profileUrl(player.robloxUserId)}
            target="_blank"
            rel="noopener noreferrer"
            variant="outline"
            size="sm"
            className="mt-5"
          >
            Ver perfil Roblox
            <ExternalLink className="size-3.5" />
          </ButtonLink>
        ) : null}
      </div>
    </Card>
  );
}
