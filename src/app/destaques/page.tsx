import { getDictionary } from '@/lib/i18n';
import { Award, Star, Target, Users } from 'lucide-react';
import type { Metadata } from 'next';
import Link from 'next/link';

import { ClubCrest, PlayerAvatar } from '@/components/common/remote-image';
import { PageHeader } from '@/components/layout/page-header';
import { Badge } from '@/components/ui/badge';
import { ButtonLink } from '@/components/ui/button';
import { Card, CardHeader, StatTile } from '@/components/ui/card';
import { EmptyState } from '@/components/ui/empty-state';
import { getActiveSeason, getPlayerRanking } from '@/lib/queries';
import { getSettings } from '@/lib/settings';
import { POSITION_LABELS } from '@/lib/utils';

export const dynamic = 'force-dynamic';

export const metadata: Metadata = {
  title: 'Destaques',
  description: 'Artilheiros, garçons, jogadores com mais partidas e o craque da temporada na VFA.',
};

export default async function HighlightsPage() {
  const dict = await getDictionary();
  const [settings, season] = await Promise.all([getSettings(), getActiveSeason()]);

  if (!season) {
    return (
      <>
        <PageHeader title={dict.pages.highlightsTitle} eyebrow={dict.pages.highlightsEyebrow} />
        <div className="container-vfa py-10">
          <EmptyState
            icon={<Star className="size-6" />}
            title="Nenhuma temporada cadastrada"
            description="Crie a temporada no painel administrativo para começar."
          />
        </div>
      </>
    );
  }

  const [scorers, assistants, appearances] = await Promise.all([
    getPlayerRanking('goals', { seasonId: season.id, limit: 3 }),
    getPlayerRanking('assists', { seasonId: season.id, limit: 3 }),
    getPlayerRanking('matches', { seasonId: season.id, limit: 3 }),
  ]);

  /**
   * "Melhor jogador da temporada" é derivado, não escolhido a dedo: quem tem a
   * maior soma de participações em gols (gols + assistências), com um mínimo de
   * partidas para não premiar quem jogou uma vez e marcou duas. O critério fica
   * escrito na tela para ninguém achar que é opinião do site.
   */
  const contributionPool = await getPlayerRanking('goals', { seasonId: season.id, limit: 40 });
  const mvp =
    [...contributionPool]
      .filter((row) => row.matches >= 3)
      .sort(
        (a, b) =>
          b.goals + b.assists - (a.goals + a.assists) ||
          b.goals - a.goals ||
          a.matches - b.matches,
      )[0] ?? null;

  const hasData = scorers.length > 0 || assistants.length > 0 || appearances.length > 0;

  return (
    <>
      <PageHeader
        eyebrow={season.name}
        title={`Destaques da ${settings.site.name}`}
        description="Os líderes das principais estatísticas da temporada, atualizados a cada resultado."
      />

      <div className="container-vfa space-y-8 py-8">
        {!hasData ? (
          <EmptyState
            icon={<Star className="size-6" />}
            title="Ainda sem destaques"
            description="Os rankings aparecem depois das primeiras partidas encerradas da temporada."
            action={<ButtonLink href="/partidas">Ver calendário</ButtonLink>}
          />
        ) : (
          <>
            {/* ══════════ CRAQUE DA TEMPORADA ══════════ */}
            {mvp ? (
              <section>
                <h2 className="display-vfa mb-4 text-lg">Melhor jogador da temporada</h2>

                <div className="sheen relative overflow-hidden rounded-3xl border border-accent/30 bg-gradient-to-br from-accent/10 via-surface to-surface p-6 sm:p-10">
                  <div className="flex flex-col items-center gap-6 sm:flex-row sm:items-center">
                    <PlayerAvatar
                      player={{
                        displayName: mvp.playerName,
                        robloxHeadshotUrl: mvp.robloxHeadshotUrl,
                        robloxAvatarUrl: mvp.robloxAvatarUrl,
                      }}
                      full
                      size={132}
                      priority
                      className="ring-4 ring-accent/30"
                    />

                    <div className="min-w-0 flex-1 text-center sm:text-left">
                      <Badge tone="accent">
                        <Award className="size-3" />
                        Craque da temporada
                      </Badge>

                      <h3 className="mt-3 text-3xl leading-none font-black tracking-tight sm:text-4xl">
                        <Link href={`/jogadores/${mvp.playerSlug}`} className="hover:text-accent">
                          {mvp.playerName}
                        </Link>
                      </h3>

                      <p className="mt-2 flex flex-wrap items-center justify-center gap-2 text-sm text-muted sm:justify-start">
                        {mvp.nationFlag ? <span>{mvp.nationFlag}</span> : null}
                        {mvp.clubName ? (
                          <Link
                            href={`/clubes/${mvp.clubSlug}`}
                            className="flex items-center gap-1.5 hover:text-accent"
                          >
                            <ClubCrest
                              club={{
                                name: mvp.clubName,
                                abbreviation: mvp.clubAbbr,
                                logoUrl: mvp.clubLogo,
                              }}
                              size={18}
                            />
                            {mvp.clubName}
                          </Link>
                        ) : null}
                        <span className="text-subtle">· {POSITION_LABELS[mvp.position]}</span>
                      </p>

                      <div className="mt-6 grid grid-cols-3 gap-3">
                        <StatTile label="Gols" value={mvp.goals} accent />
                        <StatTile label="Assistências" value={mvp.assists} accent />
                        <StatTile label="Jogos" value={mvp.matches} />
                      </div>

                      <p className="mt-4 text-xs text-subtle">
                        Critério: maior número de participações em gols (gols + assistências) entre
                        jogadores com pelo menos 3 partidas.
                      </p>
                    </div>
                  </div>
                </div>
              </section>
            ) : null}

            {/* ══════════ PÓDIOS ══════════ */}
            <section className="grid gap-5 lg:grid-cols-3">
              <PodiumCard
                title="Top artilheiros"
                icon={<Target className="size-4" />}
                rows={scorers}
                valueOf={(row) => row.goals}
                unit="gols"
              />
              <PodiumCard
                title="Top assistências"
                icon={<Star className="size-4" />}
                rows={assistants}
                valueOf={(row) => row.assists}
                unit="assist."
              />
              <PodiumCard
                title="Mais partidas"
                icon={<Users className="size-4" />}
                rows={appearances}
                valueOf={(row) => row.matches}
                unit="jogos"
              />
            </section>
          </>
        )}
      </div>
    </>
  );
}

const MEDALS = ['#ffb703', '#c7d2df', '#c98346'];

function PodiumCard({
  title,
  icon,
  rows,
  valueOf,
  unit,
}: {
  title: string;
  icon: React.ReactNode;
  rows: Awaited<ReturnType<typeof getPlayerRanking>>;
  valueOf: (row: Awaited<ReturnType<typeof getPlayerRanking>>[number]) => number;
  unit: string;
}) {
  return (
    <Card>
      <CardHeader title={title} icon={icon} />
      {rows.length === 0 ? (
        <div className="p-5 text-sm text-muted">Nenhum registro ainda.</div>
      ) : (
        <ol className="divide-y divide-line">
          {rows.map((row, index) => (
            <li key={row.playerId}>
              <Link
                href={`/jogadores/${row.playerSlug}`}
                className="flex items-center gap-3 px-4 py-3 transition-colors hover:bg-surface-2"
              >
                <span
                  className="flex size-6 shrink-0 items-center justify-center rounded-md font-mono text-xs font-black text-black"
                  style={{ backgroundColor: MEDALS[index] ?? 'var(--vfa-surface-3)' }}
                >
                  {index + 1}
                </span>
                <PlayerAvatar
                  player={{
                    displayName: row.playerName,
                    robloxHeadshotUrl: row.robloxHeadshotUrl,
                    robloxAvatarUrl: row.robloxAvatarUrl,
                  }}
                  size={34}
                />
                <span className="min-w-0 flex-1">
                  <span className="block truncate text-sm font-bold">{row.playerName}</span>
                  <span className="block truncate text-xs text-subtle">
                    {row.clubName ?? 'sem clube'}
                  </span>
                </span>
                <span className="shrink-0 text-right">
                  <span className="block font-mono text-xl leading-none font-black text-accent tabular-nums">
                    {valueOf(row)}
                  </span>
                  <span className="block text-[0.6rem] text-subtle">{unit}</span>
                </span>
              </Link>
            </li>
          ))}
        </ol>
      )}
    </Card>
  );
}
