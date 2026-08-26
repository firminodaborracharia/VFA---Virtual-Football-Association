import { ArrowRight, CalendarDays, Newspaper, Table2, Trophy, Users } from 'lucide-react';
import Link from 'next/link';

import { ClubCrest, PlayerAvatar } from '@/components/common/remote-image';
import { DemoNotice, NewsCard } from '@/components/domain/cards';
import { MatchCard, MatchRowItem } from '@/components/domain/match-card';
import { StandingsTable } from '@/components/domain/standings-table';
import { Badge } from '@/components/ui/badge';
import { ButtonLink } from '@/components/ui/button';
import { Card } from '@/components/ui/card';
import { EmptyState } from '@/components/ui/empty-state';
import { parseConfig } from '@/lib/engine/config';
import {
  getActiveSeason,
  getLeagueCompetition,
  getPlayerRanking,
  getQualificationZones,
  getStandings,
  listCompetitions,
  listLeagues,
  listMatches,
  listNews,
} from '@/lib/queries';
import { getSettings } from '@/lib/settings';
import { COMPETITION_TYPE_LABELS } from '@/lib/utils';

// Resultados e tabelas mudam a cada partida registrada; a home é sempre
// renderizada sob demanda em vez de servida de um HTML estático desatualizado.
export const dynamic = 'force-dynamic';

export default async function HomePage() {
  const settings = await getSettings();
  const season = await getActiveSeason();

  if (!season) {
    return (
      <div className="container-vfa py-20">
        <EmptyState
          icon={<Trophy className="size-7" />}
          title="Nenhuma temporada cadastrada ainda"
          description="Crie a primeira temporada no painel administrativo, ou rode o seed de demonstração para ver o site preenchido."
          action={<ButtonLink href="/admin/temporadas">Ir para o painel</ButtonLink>}
        />
      </div>
    );
  }

  const now = new Date();

  const [leagues, competitions, upcoming, recent, latestNews, topScorers, topAssists] =
    await Promise.all([
      listLeagues(),
      listCompetitions(season.id),
      listMatches({ seasonId: season.id, status: 'SCHEDULED', from: now, limit: 5, order: 'asc' }),
      listMatches({ seasonId: season.id, status: 'FINISHED', limit: 6, order: 'desc' }),
      listNews({ limit: 4 }),
      getPlayerRanking('goals', { seasonId: season.id, limit: 1 }),
      getPlayerRanking('assists', { seasonId: season.id, limit: 1 }),
    ]);

  // Tabela resumida da primeira liga cadastrada.
  const featuredLeague = leagues[0] ?? null;
  const featuredCompetition = featuredLeague
    ? await getLeagueCompetition(featuredLeague.id, season.id)
    : null;

  const [standings, zones] = await Promise.all([
    featuredCompetition ? getStandings(featuredCompetition.id) : Promise.resolve([]),
    featuredLeague ? getQualificationZones(featuredLeague.id) : Promise.resolve([]),
  ]);

  const leader = standings[0] ?? null;
  const scorer = topScorers[0] ?? null;
  const assistant = topAssists[0] ?? null;
  const featuredArticle = latestNews.rows.find((item) => item.isFeatured) ?? latestNews.rows[0];
  const otherNews = latestNews.rows.filter((item) => item.slug !== featuredArticle?.slug).slice(0, 3);

  const hasDemoData = [...recent.rows, ...upcoming.rows].length > 0 && latestNews.rows.some((n) => n.isDemo);

  return (
    <>
      {/* ══════════ HERO DA TEMPORADA ══════════ */}
      <section className="relative overflow-hidden border-b border-line">
        {season.bannerUrl ? (
          <>
            {/* eslint-disable-next-line @next/next/no-img-element */}
            <img
              src={season.bannerUrl}
              alt=""
              className="absolute inset-0 size-full object-cover opacity-25"
            />
            <div className="absolute inset-0 bg-gradient-to-t from-bg via-bg/80 to-bg/40" />
          </>
        ) : null}

        <div className="container-vfa relative py-16 sm:py-24">
          <div className="max-w-3xl">
            <Badge tone="accent" className="animate-fade-in">
              {season.name}
            </Badge>

            <h1 className="animate-fade-up mt-5 text-4xl leading-[0.95] font-black tracking-tight sm:text-6xl lg:text-7xl">
              <span className="text-gradient-accent">{settings.site.name}</span>
              <span className="text-fg"> — Temporada {season.year}</span>
            </h1>

            <p
              className="animate-fade-up mt-5 max-w-xl text-lg text-muted"
              style={{ animationDelay: '0.08s' }}
            >
              {season.tagline ?? settings.site.tagline}
            </p>

            <div
              className="animate-fade-up mt-8 flex flex-wrap gap-3"
              style={{ animationDelay: '0.16s' }}
            >
              <ButtonLink href="/partidas" size="lg">
                <CalendarDays className="size-4.5" />
                Ver partidas
              </ButtonLink>
              <ButtonLink href="/classificacao" size="lg" variant="secondary">
                <Table2 className="size-4.5" />
                Ver classificação
              </ButtonLink>
              <ButtonLink href="/jogadores" size="lg" variant="outline">
                <Users className="size-4.5" />
                Ver jogadores
              </ButtonLink>
              <ButtonLink href="/clubes" size="lg" variant="outline">
                <Trophy className="size-4.5" />
                Ver clubes
              </ButtonLink>
            </div>
          </div>
        </div>
      </section>

      <div className="container-vfa space-y-12 py-10">
        {hasDemoData ? <DemoNotice /> : null}

        {/* ══════════ PRÓXIMA PARTIDA + DESTAQUES ══════════ */}
        <section className="grid gap-4 lg:grid-cols-3">
          <div className="lg:col-span-2">
            <SectionTitle
              title="Próxima partida"
              href="/partidas"
              linkLabel="Todas as partidas"
            />
            {upcoming.rows[0] ? (
              <MatchCard match={upcoming.rows[0]} label="Próximo confronto" />
            ) : (
              <EmptyState
                title="Nenhuma partida agendada"
                description="Quando o calendário da temporada for publicado, o próximo jogo aparece aqui."
              />
            )}

            {upcoming.rows.length > 1 ? (
              <Card className="mt-4 divide-y divide-line overflow-hidden">
                {upcoming.rows.slice(1, 4).map((match) => (
                  <MatchRowItem key={match.id} match={match} />
                ))}
              </Card>
            ) : null}
          </div>

          <div className="space-y-4">
            <SectionTitle title="Destaques" href="/destaques" linkLabel="Ver todos" />

            {leader ? (
              <HighlightCard
                label="Líder da tabela"
                href={`/clubes/${leader.club.slug}`}
                media={<ClubCrest club={leader.club} size={44} />}
                title={leader.club.name}
                subtitle={`${leader.points} pontos · ${leader.won}V ${leader.drawn}E ${leader.lost}D`}
              />
            ) : null}

            {scorer ? (
              <HighlightCard
                label="Artilheiro"
                href={`/jogadores/${scorer.playerSlug}`}
                media={
                  <PlayerAvatar
                    player={{
                      displayName: scorer.playerName,
                      robloxHeadshotUrl: scorer.robloxHeadshotUrl,
                      robloxAvatarUrl: scorer.robloxAvatarUrl,
                    }}
                    size={44}
                  />
                }
                title={scorer.playerName}
                subtitle={`${scorer.goals} ${scorer.goals === 1 ? 'gol' : 'gols'} · ${scorer.clubName ?? 'sem clube'}`}
                value={scorer.goals}
              />
            ) : null}

            {assistant ? (
              <HighlightCard
                label="Líder de assistências"
                href={`/jogadores/${assistant.playerSlug}`}
                media={
                  <PlayerAvatar
                    player={{
                      displayName: assistant.playerName,
                      robloxHeadshotUrl: assistant.robloxHeadshotUrl,
                      robloxAvatarUrl: assistant.robloxAvatarUrl,
                    }}
                    size={44}
                  />
                }
                title={assistant.playerName}
                subtitle={`${assistant.assists} ${assistant.assists === 1 ? 'assistência' : 'assistências'} · ${assistant.clubName ?? 'sem clube'}`}
                value={assistant.assists}
              />
            ) : null}

            {!leader && !scorer && !assistant ? (
              <EmptyState
                title="Sem destaques ainda"
                description="Os líderes aparecem depois das primeiras partidas."
              />
            ) : null}
          </div>
        </section>

        {/* ══════════ ÚLTIMOS RESULTADOS ══════════ */}
        <section>
          <SectionTitle title="Últimos resultados" href="/partidas" linkLabel="Ver todos" />
          {recent.rows.length > 0 ? (
            <Card className="divide-y divide-line overflow-hidden">
              {recent.rows.map((match) => (
                <MatchRowItem key={match.id} match={match} />
              ))}
            </Card>
          ) : (
            <EmptyState
              title="Nenhum resultado registrado"
              description="Os placares aparecem aqui assim que as partidas forem encerradas."
            />
          )}
        </section>

        {/* ══════════ CLASSIFICAÇÃO RESUMIDA ══════════ */}
        {featuredLeague && standings.length > 0 ? (
          <section>
            <SectionTitle
              title={`Classificação — ${featuredLeague.name}`}
              href="/classificacao"
              linkLabel="Todas as ligas"
            />
            <StandingsTable
              rows={standings}
              zones={zones}
              pointsPerWin={
                featuredCompetition ? parseConfig(featuredCompetition.config).points.win : 3
              }
            />
          </section>
        ) : null}

        {/* ══════════ COMPETIÇÕES ══════════ */}
        {competitions.length > 0 ? (
          <section>
            <SectionTitle
              title="Competições em andamento"
              href="/competicoes"
              linkLabel="Ver todas"
            />
            <div className="stagger grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
              {competitions
                .filter((competition) => competition.status !== 'DRAFT')
                .slice(0, 8)
                .map((competition) => (
                  <Link
                    key={competition.id}
                    href={`/competicoes/${competition.slug}`}
                    className="sheen group rounded-2xl border border-line bg-surface p-5 transition-all duration-300 hover:-translate-y-1 hover:border-accent/40 hover:shadow-pop motion-reduce:hover:translate-y-0"
                  >
                    <div
                      className="flex size-11 items-center justify-center rounded-xl text-lg font-black"
                      style={{
                        backgroundColor: `${competition.accent ?? '#00e08f'}1a`,
                        color: competition.accent ?? 'var(--vfa-accent)',
                      }}
                    >
                      {(competition.shortName ?? competition.name).slice(0, 2).toUpperCase()}
                    </div>
                    <h3 className="mt-4 font-bold text-fg transition-colors group-hover:text-accent">
                      {competition.name}
                    </h3>
                    <p className="mt-1 text-xs text-subtle">
                      {COMPETITION_TYPE_LABELS[competition.type]}
                    </p>
                    {competition.championName ? (
                      <p className="mt-3 flex items-center gap-1.5 border-t border-line pt-3 text-xs text-accent-warm">
                        <Trophy className="size-3.5" />
                        {competition.championName}
                      </p>
                    ) : null}
                  </Link>
                ))}
            </div>
          </section>
        ) : null}

        {/* ══════════ NOTÍCIAS ══════════ */}
        <section>
          <SectionTitle title={`${settings.site.name} News`} href="/noticias" linkLabel="Todas as notícias" />
          {featuredArticle ? (
            <div className="space-y-4">
              <NewsCard article={featuredArticle} featured />
              {otherNews.length > 0 ? (
                <div className="stagger grid gap-4 sm:grid-cols-3">
                  {otherNews.map((article) => (
                    <NewsCard key={article.id} article={article} />
                  ))}
                </div>
              ) : null}
            </div>
          ) : (
            <EmptyState
              icon={<Newspaper className="size-6" />}
              title="Nenhuma notícia publicada"
              description="As matérias da VFA News aparecem aqui depois de publicadas no painel."
            />
          )}
        </section>
      </div>
    </>
  );
}

function SectionTitle({
  title,
  href,
  linkLabel,
}: {
  title: string;
  href?: string;
  linkLabel?: string;
}) {
  return (
    <div className="mb-4 flex items-end justify-between gap-4">
      <h2 className="text-xl font-black tracking-tight sm:text-2xl">{title}</h2>
      {href ? (
        <Link
          href={href}
          className="group flex shrink-0 items-center gap-1 text-sm font-semibold text-muted transition-colors hover:text-accent"
        >
          {linkLabel ?? 'Ver mais'}
          <ArrowRight className="size-4 transition-transform group-hover:translate-x-0.5" />
        </Link>
      ) : null}
    </div>
  );
}

function HighlightCard({
  label,
  href,
  media,
  title,
  subtitle,
  value,
}: {
  label: string;
  href: string;
  media: React.ReactNode;
  title: string;
  subtitle: string;
  value?: number;
}) {
  return (
    <Link
      href={href}
      className="sheen group flex items-center gap-3 rounded-2xl border border-line bg-surface p-4 transition-all duration-300 hover:border-accent/40 hover:shadow-pop"
    >
      {media}
      <div className="min-w-0 flex-1">
        <p className="text-[0.65rem] font-bold tracking-widest text-subtle uppercase">{label}</p>
        <p className="truncate font-bold text-fg transition-colors group-hover:text-accent">
          {title}
        </p>
        <p className="truncate text-xs text-muted">{subtitle}</p>
      </div>
      {typeof value === 'number' ? (
        <span className="shrink-0 font-mono text-2xl font-black text-accent tabular-nums">
          {value}
        </span>
      ) : null}
    </Link>
  );
}
