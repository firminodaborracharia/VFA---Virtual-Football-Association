import {
  ArrowRight,
  CalendarDays,
  Shield,
  Table2,
  Trophy,
  Users,
} from 'lucide-react';
import Link from 'next/link';

import { ClubCrest, PlayerAvatar } from '@/components/common/remote-image';
import { DemoNotice } from '@/components/domain/cards';
import { RankBadge } from '@/components/domain/rank-badge';
import { ButtonLink } from '@/components/ui/button';
import { EmptyState } from '@/components/ui/empty-state';
import { withDeadline } from '@/db';
import { getDictionary } from '@/lib/i18n';
import { getActiveSeason, getSeasonTotals, listClubs, listPlayers } from '@/lib/queries';
import { getSettings } from '@/lib/settings';
import { cn, POSITION_LABELS } from '@/lib/utils';

// Resultados e tabelas mudam a cada partida registrada; a home é sempre
// renderizada sob demanda em vez de servida de um HTML estático desatualizado.
/** Imagem padrão do hero, empacotada com o projeto. */
const HERO_IMAGE = '/img/hero.webp';

export const dynamic = 'force-dynamic';

export default async function HomePage() {
  const dict = await getDictionary();
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

  /**
   * `withDeadline` para que a home nunca fique num esqueleto eterno.
   *
   * Se o banco parar de responder no meio, o `Promise.all` fica pendente para
   * sempre e o visitante vê o carregamento girar sem fim — sem erro na tela,
   * sem nada no terminal. Com prazo, isso vira uma mensagem que diz o que
   * aconteceu e o que rodar.
   */
  const [clubs, playersPage, totals] = await withDeadline(
    Promise.all([
      listClubs(),
      // 12 jogadores: três fileiras de quatro em tela grande, e o link "ver
      // todos" leva ao restante. Trazer os 120 aqui seria uma home infinita.
      listPlayers({ limit: 12 }),
      getSeasonTotals(season.id),
    ]),
    { label: 'Os dados da página inicial' },
  );

  /**
   * Os jogadores com maior overall primeiro.
   *
   * A ordenação é feita AQUI e não no banco de propósito: são doze registros
   * já carregados, e quem ainda não tem nota vai para o fim em vez de sumir da
   * lista — que é o que um `order by overall desc nulls last` no banco também
   * faria, mas exigindo mais uma ida ao Postgres para um recorte tão pequeno.
   */
  const topPlayers = [...playersPage.rows].sort(
    (a, b) => (b.overall ?? -1) - (a.overall ?? -1),
  );

  type ClubRow = (typeof clubs)[number];
  const clubsByLeague = new Map<string, ClubRow[]>();
  for (const club of clubs) {
    const list = clubsByLeague.get(club.leagueName ?? '—') ?? [];
    list.push(club);
    clubsByLeague.set(club.leagueName ?? '—', list);
  }

  const hasDemoData = clubs.some((club) => club.isDemo);

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
          conteúdo, e vão vazio é o que faz uma página parecer inacabada.
        */}
        <div className="relative border-t border-line/60 bg-bg/40 backdrop-blur-sm">
          {/*
            Dois números, não quatro.

            Partidas e gols saíram junto com o resto do conteúdo de jogo: a
            home passou a ser sobre clubes e jogadores, e um número solto de
            partidas aqui prometeria uma seção que não existe mais nesta
            página.
          */}
          <div className="container-vfa grid grid-cols-2 divide-x divide-line/60">
            <HeroStat label={dict.home.clubsCount} value={totals.clubs} />
            <HeroStat label={dict.home.playersCount} value={totals.players} accent />
          </div>
        </div>
      </section>

      <div className="container-vfa space-y-12 py-10">
        {hasDemoData ? <DemoNotice /> : null}

        {/*
          ══════════ CLUBES ══════════

          Agrupados por liga, e não numa grade única.

          Com 24 clubes lado a lado, a liga de cada um vira uma etiqueta que
          ninguém lê. Agrupado, a estrutura da VFA — quatro ligas, seis clubes
          cada — fica visível sem precisar de explicação.
        */}
        <section>
          <SectionTitle title={dict.nav.clubs} href="/clubes" linkLabel={dict.home.viewAll} />

          {clubs.length === 0 ? (
            <EmptyState
              icon={<Shield className="size-6" />}
              title={dict.home.noClubs}
              description={dict.home.noClubsHelp}
            />
          ) : (
            <div className="space-y-8">
              {[...clubsByLeague.entries()].map(([leagueName, leagueClubs]) => (
                <div key={leagueName}>
                  <div className="mb-3 flex items-center gap-3">
                    <span className="eyebrow">{leagueName}</span>
                    <span className="rule-accent" aria-hidden />
                  </div>

                  <div className="stagger grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
                    {leagueClubs.map((club) => (
                      <Link
                        key={club.id}
                        href={`/clubes/${club.slug}`}
                        className="glass group flex items-center gap-3 rounded-xl p-3 transition-all duration-300 hover:-translate-y-0.5 hover:border-accent/40 motion-reduce:hover:translate-y-0"
                      >
                        <ClubCrest club={club} size={40} />
                        <div className="min-w-0 flex-1">
                          <p className="truncate text-sm font-bold text-fg">{club.name}</p>
                          <p className="truncate text-xs text-muted">
                            {club.ownerName ?? club.abbreviation}
                          </p>
                        </div>
                        <ArrowRight className="size-4 shrink-0 text-subtle transition-all group-hover:translate-x-0.5 group-hover:text-accent" />
                      </Link>
                    ))}
                  </div>
                </div>
              ))}
            </div>
          )}
        </section>

        {/*
          ══════════ JOGADORES ══════════

          Ordenados por overall, com o selo do rank em evidência. É a lista que
          responde "quem são os melhores da VFA hoje" — a pergunta que leva
          alguém a abrir um site de liga.
        */}
        <section>
          <SectionTitle title={dict.nav.players} href="/jogadores" linkLabel={dict.home.viewAll} />

          {topPlayers.length === 0 ? (
            <EmptyState
              icon={<Users className="size-6" />}
              title={dict.home.noPlayers}
              description={dict.home.noPlayersHelp}
            />
          ) : (
            <div className="stagger grid gap-3 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4">
              {topPlayers.map((player) => (
                <Link
                  key={player.id}
                  href={`/jogadores/${player.slug}`}
                  className="glass group rounded-xl p-4 transition-all duration-300 hover:-translate-y-1 hover:border-accent/40 motion-reduce:hover:translate-y-0"
                >
                  <div className="flex items-center gap-3">
                    <PlayerAvatar player={player} size={44} />
                    <div className="min-w-0 flex-1">
                      <p className="truncate text-sm font-bold text-fg">{player.displayName}</p>
                      <p className="truncate text-xs text-muted">
                        {POSITION_LABELS[player.position]}
                      </p>
                    </div>
                  </div>

                  <div className="mt-3 flex items-center justify-between gap-2 border-t border-line/60 pt-3">
                    <span className="truncate text-xs text-subtle">
                      {player.clubName ?? dict.home.noClub}
                    </span>
                    <RankBadge overall={player.overall} size="sm" />
                  </div>
                </Link>
              ))}
            </div>
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
