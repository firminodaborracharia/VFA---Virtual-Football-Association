import type { Metadata } from 'next';

import { CompetitionsManager } from '@/components/admin/competitions-manager';
import { ZonesManager } from '@/components/admin/zones-manager';
import { parseConfig } from '@/lib/engine/config';
import { EmptyState } from '@/components/ui/empty-state';
import {
  getActiveSeason,
  getQualificationZones,
  listClubs,
  listCompetitionsAdmin,
  listLeagues,
} from '@/lib/queries';
import { requireAdmin } from '@/lib/rbac';

export const dynamic = 'force-dynamic';

export const metadata: Metadata = { title: 'Competições' };

export default async function AdminCompetitionsPage() {
  // Checagem obrigatória ANTES de qualquer consulta ao banco.
  //
  // No App Router o `layout` e a `page` renderizam em paralelo: se a proteção
  // ficasse só no layout, os dados desta página já teriam sido buscados e
  // transmitidos no HTML antes de o redirect do layout acontecer. Aqui a
  // função lança o redirect antes de qualquer query, então nada vaza.
  await requireAdmin();

  const season = await getActiveSeason();

  if (!season) {
    return (
      <EmptyState
        title="Nenhuma temporada ativa"
        description="Crie e ative uma temporada em Administração → Temporadas antes de configurar competições."
      />
    );
  }

  const [competitions, leagues, clubs] = await Promise.all([
    listCompetitionsAdmin(season.id),
    listLeagues(),
    listClubs(),
  ]);

  const detailed = competitions.map((competition) => ({
    id: competition.id,
    slug: competition.slug,
    name: competition.name,
    shortName: competition.shortName,
    type: competition.type,
    status: competition.status,
    leagueId: competition.leagueId,
    parentSlug: competition.parentSlug,
    accent: competition.accent,
    sortOrder: competition.sortOrder,
    config: parseConfig(competition.config),
    teamIds: competition.teamIds,
    championName: competition.championName,
  }));

  const leaguesWithZones = await Promise.all(
    leagues.map(async (league) => ({
      id: league.id,
      name: league.name,
      zones: (await getQualificationZones(league.id)).map((zone) => ({
        key: zone.id,
        label: zone.label,
        color: zone.color,
        fromPosition: zone.fromPosition,
        toPosition: zone.toPosition,
        targetSlug: zone.targetSlug ?? '',
        sortOrder: zone.sortOrder,
      })),
    })),
  );

  return (
    <div className="space-y-8">
      <CompetitionsManager
        competitions={detailed}
        leagues={leagues.map((league) => ({ id: league.id, name: league.name }))}
        clubs={clubs.map((club) => ({
          id: club.id,
          name: club.name,
          leagueId: club.leagueId,
        }))}
        seasonId={season.id}
      />

      <section>
        <h2 className="display-vfa mb-3 text-lg">Zonas de classificação</h2>
        <p className="mb-4 text-sm text-muted">
          Define as faixas coloridas da tabela e para onde cada faixa classifica. É isto que faz
          &ldquo;os 4 primeiros vão à Libertadores&rdquo; funcionar sem estar escrito no código.
        </p>
        <ZonesManager
          leagues={leaguesWithZones}
          competitions={competitions.map((competition) => ({
            slug: competition.slug,
            name: competition.name,
          }))}
        />
      </section>
    </div>
  );
}
