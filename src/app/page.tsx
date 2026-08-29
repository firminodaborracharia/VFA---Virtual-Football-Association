import {
  ArrowRight,
  BarChart3,
  CalendarDays,
  Newspaper,
  Shield,
  Table2,
  Trophy,
  Users,
} from 'lucide-react';
import Link from 'next/link';

import { ClubCrest, PlayerAvatar } from '@/components/common/remote-image';
import { DemoNotice, NewsCard } from '@/components/domain/cards';
import { MatchCard, MatchRowItem } from '@/components/domain/match-card';
import { StandingsTable } from '@/components/domain/standings-table';
import { ButtonLink } from '@/components/ui/button';
import { Card } from '@/components/ui/card';
import { EmptyState } from '@/components/ui/empty-state';
import { withDeadline } from '@/db';
import type { Dictionary } from '@/lib/i18n/dictionaries';
import { parseConfig } from '@/lib/engine/config';
import {
  getActiveSeason,
  getLeagueCompetition,
  getPlayerRanking,
  getQualificationZones,
  getSeasonTotals,
  getStandings,
  listCompetitions,
  listLeagues,
  listMatches,
  listNews,
} from '@/lib/queries';
import { getDictionary, getLocale } from '@/lib/i18n';
import { getSettings } from '@/lib/settings';
import { cn, COMPETITION_TYPE_LABELS } from '@/lib/utils';

// Resultados e tabelas mudam a cada partida registrada; a home é sempre
// renderizada sob demanda em vez de servida de um HTML estático desatualizado.
/** Imagem padrão do hero, empacotada com o projeto. */
const HERO_IMAGE = '/img/hero.webp';

export const dynamic = 'force-dynamic';

export default async function HomePage() {
  const dict = await getDictionary();
  const locale = await getLocale();
  const settings = await getSettings();
  const season = await getActiveSeason();

  if (!season) {
    return (
      <div className="container-vfa py-20">
        <EmptyState
          icon={<Trophy className="size-7" />}
          title={dict.home.noSeason}
          description={dict.home.noSeasonHelp}
          action={<ButtonLink href="/admin/temporadas">{dict.home.goToAdmin}</ButtonLink>}
        />
      </div>
    );
  }

  const now = new Date();

  /**
   * `withDeadline` para que a home nunca fique num esqueleto eterno.
   *
   * São dez consultas em paralelo. Se o banco parar de responder no meio, o
   * `Promise.all` fica pendente para sempre e o visitante vê o carregamento
   * girar sem fim — sem erro na tela, sem nada no terminal. Com prazo, isso
   * vira uma mensagem que diz o que aconteceu e o que rodar.
   */
  const [leagues, competitions, upcoming, recent, latestNews, topScorers, topAssists, totals] =
    await withDeadline(
      Promise.all([
        listLeagues(),
        listCompetitions(season.id),
        listMatches({ seasonId: season.id, status: 'SCHEDULED', from: now, limit: 5, order: 'asc' }),
        listMatches({ seasonId: season.id, status: 'FINISHED', limit: 6, order: 'desc' }),
        listNews({ limit: 4, locale }),
        getPlayerRanking('goals', { seasonId: season.id, limit: 1 }),
        getPlayerRanking('assists', { seasonId: season.id, limit: 1 }),
        getSeasonTotals(season.id),
      ]),
      { label: 'Os dados da página inicial' },
    );

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
        {/*
          Imagem de fundo desfocada.

          O desfoque não é enfeite: é o que torna a foto utilizável como fundo.
          Nítida, ela disputa atenção com a manchete e faz o texto branco cair
          em cima de detalhes claros — o nome da temporada some sobre o refletor
          do estádio. Desfocada, sobra o que interessa (a cor, a luz, a
          sensação de entrar em campo) e o texto ganha uma superfície calma.

          `scale-110` existe por causa do desfoque: o filtro esvazia as bordas
          da imagem, e sem a ampliação apareceria uma moldura clara em volta.

          O banner da temporada, quando cadastrado, tem prioridade sobre a
          imagem padrão — é o administrador trocando a arte sem tocar no código.
        */}
        <div className="absolute inset-0" aria-hidden>
          {/* eslint-disable-next-line @next/next/no-img-element */}
          <img
            src={season.bannerUrl ?? HERO_IMAGE}
            alt=""
            className="size-full scale-110 object-cover object-center blur-[5px]"
          />
          {/*
            O escurecimento é DIRECIONAL, não uniforme.

            A primeira versão usava duas camadas cobrindo a área inteira e a
            foto praticamente sumiu — sobrou uma mancha escura que não valia o
            peso do arquivo. O texto ocupa só a metade esquerda, então é lá que
            o fundo precisa fechar; à direita a imagem fica visível e faz o
            trabalho para o qual foi escolhida.

            A camada de baixo costura o hero com o resto da página, para a foto
            não terminar num corte reto.
          */}
          <div className="absolute inset-0 bg-gradient-to-r from-bg via-bg/75 to-bg/25" />
          <div className="absolute inset-x-0 bottom-0 h-32 bg-gradient-to-t from-bg to-transparent" />
          <div className="absolute inset-x-0 top-0 h-24 bg-gradient-to-b from-bg/70 to-transparent" />
        </div>

        <div className="container-vfa relative py-14 sm:py-20">
          <div className="max-w-3xl">
            <span className="eyebrow animate-fade-in">{season.name}</span>

            {/*
              O ano vem primeiro e enorme, como capa de almanaque de campeonato.
              Antes o título era uma frase corrida em caixa mista — legível, mas
              indistinguível de qualquer página de produto.
            */}
            <h1 className="animate-fade-up mt-4">
              <span className="display-italic block text-6xl text-fg/15 sm:text-8xl lg:text-9xl">
                {season.year}
              </span>
              <span className="display-vfa -mt-2 block text-4xl sm:text-6xl lg:text-7xl">
                <span className="text-gradient-accent">{settings.site.name}</span>{' '}
                <span className="text-fg">{dict.home.seasonWord}</span>
              </span>
            </h1>

            <p
              className="animate-fade-up mt-6 max-w-xl text-lg text-muted"
              style={{ animationDelay: '0.08s' }}
            >
              {season.tagline ?? settings.site.tagline}
            </p>

            {/*
              Dois botões, não quatro.

              Jogadores e Clubes já estão no menu do topo, visíveis em toda
              página. Repetir os quatro aqui quebrava a linha em telas médias e
              diluía a chamada: com quatro pesos iguais, nenhum é o principal.
            */}
            <div
              className="animate-fade-up mt-8 flex flex-wrap gap-3"
              style={{ animationDelay: '0.16s' }}
            >
              <ButtonLink href="/partidas" size="lg">
                <CalendarDays className="size-4.5" />
                {dict.home.viewMatches}
              </ButtonLink>
              <ButtonLink href="/classificacao" size="lg" variant="secondary">
                <Table2 className="size-4.5" />
                {dict.home.viewStandings}
              </ButtonLink>
            </div>
          </div>
        </div>

        {/*
          Faixa de números da temporada, encostada na base do hero.

          Não é enfeite: era aqui que sobrava um vão vazio entre a manchete e o
          conteúdo, e vão vazio é o que faz uma página parecer inacabada. Toda
          liga de verdade abre com estes quatro números porque eles respondem,
          numa olhada, "de que tamanho é esta competição".
        */}
        <div className="relative border-t border-line/60 bg-bg/40 backdrop-blur-sm">
          <div className="container-vfa grid grid-cols-2 divide-x divide-line/60 sm:grid-cols-4">
            <HeroStat label={dict.home.clubsCount} value={totals.clubs} />
            <HeroStat label={dict.home.playersCount} value={totals.players} />
            <HeroStat label={dict.home.matchesCount} value={totals.matchesPlayed} />
            <HeroStat label={dict.home.goalsCount} value={totals.goals} accent />
          </div>
        </div>
      </section>

      <div className="container-vfa space-y-12 py-10">
        {hasDemoData ? <DemoNotice /> : null}

        {/* ══════════ CATEGORIAS ══════════ */}
        <section>
          <SectionTitle title={dict.home.categories} />
          <CategoryGrid dict={dict} />
        </section>

        {/*
          ══════════ NOTÍCIAS ══════════

          Primeira seção da home, e não a última como estava.

          Site de liga é veículo antes de ser banco de dados: quem chega quer
          saber o que aconteceu, e tabela e calendário estão a um clique no
          menu. Notícia no rodapé é notícia que ninguém lê — e, pior, deixa a
          home idêntica em todos os dias em que nenhum jogo acontece.
        */}
        <section>
          <SectionTitle
            title={`${settings.site.name} News`}
            href="/noticias"
            linkLabel={dict.home.allNews}
          />
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
              title={dict.home.noNews}
              description={dict.home.noNewsHelp}
            />
          )}
        </section>

        {/* ══════════ PRÓXIMA PARTIDA + DESTAQUES ══════════ */}
        <section className="grid gap-4 lg:grid-cols-3">
          <div className="lg:col-span-2">
            <SectionTitle
              title={dict.home.nextMatch}
              href="/partidas"
              linkLabel={dict.home.allMatches}
            />
            {upcoming.rows[0] ? (
              <MatchCard match={upcoming.rows[0]} label={dict.home.nextFixture} />
            ) : (
              <EmptyState
                title={dict.home.noMatches}
                description={dict.home.noMatchesHelp}
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
            <SectionTitle title={dict.home.highlights} href="/destaques" linkLabel={dict.home.viewAll} />

            {leader ? (
              <HighlightCard
                label={dict.home.tableLeader}
                href={`/clubes/${leader.club.slug}`}
                media={<ClubCrest club={leader.club} size={44} />}
                title={leader.club.name}
                subtitle={`${leader.points} ${dict.home.points} · ${leader.won}${dict.standings.winShort} ${leader.drawn}${dict.standings.drawShort} ${leader.lost}${dict.standings.lossShort}`}
              />
            ) : null}

            {scorer ? (
              <HighlightCard
                label={dict.home.topScorer}
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
                subtitle={`${scorer.goals} ${scorer.goals === 1 ? dict.home.goal : dict.home.goals} · ${scorer.clubName ?? dict.home.noClub}`}
                value={scorer.goals}
              />
            ) : null}

            {assistant ? (
              <HighlightCard
                label={dict.home.topAssists}
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
                subtitle={`${assistant.assists} ${dict.home.assists} · ${assistant.clubName ?? dict.home.noClub}`}
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
          <SectionTitle title={dict.home.latestResults} href="/partidas" linkLabel={dict.home.viewAll} />
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
              title={`${dict.home.standings} — ${featuredLeague.name}`}
              href="/classificacao"
              linkLabel={dict.home.fullTable}
            />
            <StandingsTable
              dict={dict}
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
              title={dict.home.competitions}
              href="/competicoes"
              linkLabel={dict.home.viewAll}
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
    <div className="mb-4 flex items-center gap-4">
      <h2 className="display-vfa shrink-0 text-xl sm:text-2xl">{title}</h2>
      {/* A régua ocupa a sobra da linha: o título deixa de flutuar solto e passa
          a ter cabeçalho de seção, no espírito de página de jornal esportivo. */}
      <span className="rule-accent" aria-hidden />
      {href ? (
        <Link
          href={href}
          className="group flex shrink-0 items-center gap-1 text-xs font-extrabold tracking-widest text-muted uppercase transition-colors hover:text-accent"
        >
          {linkLabel ?? 'Ver mais'}
          <ArrowRight className="size-3.5 transition-transform group-hover:translate-x-0.5" />
        </Link>
      ) : null}
    </div>
  );
}

/**
 * Grade de categorias — o atalho para as seções principais.
 *
 * Cada cartão é uma porta larga com ícone, título e uma frase que diz o que se
 * encontra ali. Isso resolve um problema real do menu: "Destaques" e
 * "Estatísticas" não dizem nada a quem chega pela primeira vez, e o menu não
 * tem espaço para explicar. Aqui tem.
 */
function CategoryGrid({ dict }: { dict: Dictionary }) {
  const categories = [
    {
      href: '/jogadores',
      icon: Users,
      title: dict.nav.players,
      description: dict.categories.players,
    },
    { href: '/clubes', icon: Shield, title: dict.nav.clubs, description: dict.categories.clubs },
    {
      href: '/classificacao',
      icon: Table2,
      title: dict.nav.standings,
      description: dict.categories.standings,
    },
    {
      href: '/partidas',
      icon: CalendarDays,
      title: dict.nav.matches,
      description: dict.categories.matches,
    },
    {
      href: '/competicoes',
      icon: Trophy,
      title: dict.nav.competitions,
      description: dict.categories.competitions,
    },
    {
      href: '/estatisticas',
      icon: BarChart3,
      title: dict.nav.stats,
      description: dict.categories.stats,
    },
  ];

  return (
    <div className="stagger grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
      {categories.map((category) => {
        const Icon = category.icon;
        return (
          <Link
            key={category.href}
            href={category.href}
            className="glass group relative overflow-hidden rounded-2xl p-5 transition-all duration-300 hover:-translate-y-1 hover:border-accent/40 motion-reduce:hover:translate-y-0"
          >
            {/* Brilho que segue o canto superior direito no hover. Aparece por
                trás do conteúdo e some sozinho — nenhum estado em JavaScript. */}
            <span
              className="pointer-events-none absolute -top-16 -right-16 size-40 rounded-full bg-accent/20 opacity-0 blur-3xl transition-opacity duration-500 group-hover:opacity-100"
              aria-hidden
            />

            <span className="relative flex size-11 items-center justify-center rounded-xl bg-accent/12 text-accent transition-transform duration-300 group-hover:scale-110">
              <Icon className="size-5" />
            </span>

            <h3 className="display-vfa relative mt-4 text-lg">{category.title}</h3>
            <p className="relative mt-1 text-sm text-muted">{category.description}</p>

            <ArrowRight className="absolute top-5 right-5 size-4 text-subtle transition-all duration-300 group-hover:translate-x-1 group-hover:text-accent" />
          </Link>
        );
      })}
    </div>
  );
}

/** Um número da faixa do hero. */
function HeroStat({
  label,
  value,
  accent = false,
}: {
  label: string;
  value: number;
  accent?: boolean;
}) {
  return (
    <div className="px-1 py-5 text-center sm:py-6">
      <div
        className={cn(
          'scoreboard text-3xl leading-none sm:text-4xl',
          accent ? 'text-accent' : 'text-fg',
        )}
      >
        {value.toLocaleString('pt-BR')}
      </div>
      <div className="mt-2 text-[0.65rem] font-extrabold tracking-[0.18em] text-subtle uppercase">
        {label}
      </div>
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
