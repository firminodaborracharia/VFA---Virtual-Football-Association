import { CalendarDays, Globe2, Newspaper, Trophy, Users } from 'lucide-react';
import Link from 'next/link';

import { ClubCrest } from '@/components/common/remote-image';
import { MatchRowItem } from '@/components/domain/match-card';
import { RecomputeButton } from '@/components/admin/recompute-button';
import { Badge } from '@/components/ui/badge';
import { ButtonLink } from '@/components/ui/button';
import { Card, CardHeader, StatTile } from '@/components/ui/card';
import { EmptyState } from '@/components/ui/empty-state';
import { publishScheduledNews } from '@/lib/mutations';
import {
  getActiveSeason,
  getCounts,
  listClubs,
  listCompetitions,
  listLeagues,
  listMatches,
} from '@/lib/queries';
import { requireAdmin } from '@/lib/rbac';

export const dynamic = 'force-dynamic';

export default async function AdminDashboard() {
  // Checagem obrigatória ANTES de qualquer consulta ao banco.
  //
  // No App Router o `layout` e a `page` renderizam em paralelo: se a proteção
  // ficasse só no layout, os dados desta página já teriam sido buscados e
  // transmitidos no HTML antes de o redirect do layout acontecer. Aqui a
  // função lança o redirect antes de qualquer query, então nada vaza.
  await requireAdmin();

  // Aproveita a visita ao painel para publicar o que estava agendado, assim o
  // agendamento funciona mesmo sem um cron configurado.
  await publishScheduledNews().catch(() => 0);

  const season = await getActiveSeason();

  const [counts, leagues, clubs] = await Promise.all([getCounts(), listLeagues(), listClubs()]);

  const [competitions, upcoming, recent] = await Promise.all([
    season ? listCompetitions(season.id) : Promise.resolve([]),
    listMatches({ seasonId: season?.id, status: 'SCHEDULED', from: new Date(), limit: 5 }),
    listMatches({ seasonId: season?.id, status: 'FINISHED', limit: 5, order: 'desc' }),
  ]);

  const clubsByLeague = leagues.map((league) => ({
    league,
    count: clubs.filter((club) => club.leagueId === league.id).length,
  }));

  return (
    <div className="space-y-6">
      {!season ? (
        <EmptyState
          icon={<CalendarDays className="size-6" />}
          title="Nenhuma temporada ativa"
          description="Crie e ative uma temporada para que o site comece a mostrar dados."
          action={<ButtonLink href="/admin/temporadas">Criar temporada</ButtonLink>}
        />
      ) : (
        <div className="flex flex-wrap items-center gap-3 rounded-2xl border border-line bg-surface px-5 py-4">
          <Badge tone="accent">Temporada ativa</Badge>
          <span className="font-bold">{season.name}</span>
          <span className="text-sm text-subtle">{season.tagline}</span>
          <div className="ml-auto">
            <RecomputeButton seasonId={season.id} />
          </div>
        </div>
      )}

      <div className="grid grid-cols-2 gap-3 sm:grid-cols-3 lg:grid-cols-5">
        <StatTile label="Jogadores" value={counts.players} />
        <StatTile label="Clubes" value={counts.clubs} />
        <StatTile label="Partidas" value={counts.matches} />
        <StatTile label="Competições" value={counts.competitions} />
        <StatTile label="Notícias" value={counts.news} />
      </div>

      <div className="grid gap-5 lg:grid-cols-2">
        <Card>
          <CardHeader
            title="Clubes por liga"
            icon={<Trophy className="size-4" />}
            action={
              <Link href="/admin/clubes" className="text-xs font-semibold text-accent">
                Gerenciar
              </Link>
            }
          />
          {clubsByLeague.length === 0 ? (
            <div className="p-5 text-sm text-muted">Nenhuma liga cadastrada.</div>
          ) : (
            <ul className="divide-y divide-line">
              {clubsByLeague.map(({ league, count }) => (
                <li key={league.id} className="flex items-center gap-3 px-5 py-3">
                  <span
                    className="size-2.5 rounded-full"
                    style={{ backgroundColor: league.accent ?? 'var(--vfa-accent)' }}
                  />
                  <span className="flex-1 truncate text-sm font-semibold">
                    {league.nationFlag ? `${league.nationFlag} ` : ''}
                    {league.name}
                  </span>
                  <span className="font-mono text-sm text-muted tabular-nums">{count}</span>
                </li>
              ))}
            </ul>
          )}
        </Card>

        <Card>
          <CardHeader
            title="Competições da temporada"
            icon={<Globe2 className="size-4" />}
            action={
              <Link href="/admin/competicoes" className="text-xs font-semibold text-accent">
                Gerenciar
              </Link>
            }
          />
          {competitions.length === 0 ? (
            <div className="p-5 text-sm text-muted">Nenhuma competição criada nesta temporada.</div>
          ) : (
            <ul className="divide-y divide-line">
              {competitions.map((competition) => (
                <li key={competition.id} className="flex items-center gap-3 px-5 py-3">
                  <span className="flex-1 truncate text-sm font-semibold">{competition.name}</span>
                  {competition.championName ? (
                    <span className="flex items-center gap-1.5 text-xs text-accent-warm">
                      <ClubCrest
                        club={{ name: competition.championName, logoUrl: competition.championLogo }}
                        size={16}
                      />
                      campeão
                    </span>
                  ) : null}
                  <Badge tone={competition.status === 'IN_PROGRESS' ? 'accent' : 'neutral'}>
                    {competition.status === 'IN_PROGRESS'
                      ? 'Em andamento'
                      : competition.status === 'FINISHED'
                        ? 'Encerrada'
                        : competition.status === 'UPCOMING'
                          ? 'Em breve'
                          : 'Rascunho'}
                  </Badge>
                </li>
              ))}
            </ul>
          )}
        </Card>

        <Card>
          <CardHeader
            title="Próximas partidas"
            icon={<CalendarDays className="size-4" />}
            action={
              <Link href="/admin/partidas" className="text-xs font-semibold text-accent">
                Gerenciar
              </Link>
            }
          />
          {upcoming.rows.length === 0 ? (
            <div className="p-5 text-sm text-muted">Nenhuma partida agendada.</div>
          ) : (
            <div className="divide-y divide-line">
              {upcoming.rows.map((match) => (
                <MatchRowItem key={match.id} match={match} />
              ))}
            </div>
          )}
        </Card>

        <Card>
          <CardHeader title="Últimos resultados" icon={<Users className="size-4" />} />
          {recent.rows.length === 0 ? (
            <div className="p-5 text-sm text-muted">Nenhum resultado registrado.</div>
          ) : (
            <div className="divide-y divide-line">
              {recent.rows.map((match) => (
                <MatchRowItem key={match.id} match={match} />
              ))}
            </div>
          )}
        </Card>
      </div>

      <Card>
        <CardHeader title="Atalhos" icon={<Newspaper className="size-4" />} />
        <div className="flex flex-wrap gap-2 p-5">
          <ButtonLink href="/admin/jogadores" variant="secondary" size="sm">
            Cadastrar jogador
          </ButtonLink>
          <ButtonLink href="/admin/clubes" variant="secondary" size="sm">
            Cadastrar clube
          </ButtonLink>
          <ButtonLink href="/admin/partidas" variant="secondary" size="sm">
            Registrar resultado
          </ButtonLink>
          <ButtonLink href="/admin/competicoes" variant="secondary" size="sm">
            Gerar confrontos
          </ButtonLink>
          <ButtonLink href="/admin/noticias" variant="secondary" size="sm">
            Escrever notícia
          </ButtonLink>
        </div>
      </Card>
    </div>
  );
}
