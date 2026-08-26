import Link from 'next/link';

import { FormDot } from '@/components/ui/badge';
import { ClubCrest } from '@/components/common/remote-image';
import { EmptyState } from '@/components/ui/empty-state';
import type { Zone } from '@/lib/engine/standings';
import { zoneForPosition } from '@/lib/engine/standings';
import type { StandingEntry } from '@/lib/queries';
import { cn, efficiency, formatDiff } from '@/lib/utils';

export type ZoneDefinition = {
  label: string;
  color: string;
  fromPosition: number;
  toPosition: number;
  targetSlug: string | null;
};

/**
 * Tabela de classificação no formato do Brasileirão — item 8 do escopo.
 *
 * As faixas coloridas de classificação (Libertadores, Champions, eliminado)
 * vêm da configuração da liga, não do código: rótulo, cor e intervalo de
 * posições são definidos pelo administrador.
 */
export function StandingsTable({
  rows,
  zones = [],
  pointsPerWin = 3,
  compact = false,
  highlightClubId,
  showForm = true,
}: {
  rows: StandingEntry[];
  zones?: ZoneDefinition[];
  pointsPerWin?: number;
  /** Versão resumida usada na home: menos colunas. */
  compact?: boolean;
  highlightClubId?: string;
  showForm?: boolean;
}) {
  if (rows.length === 0) {
    return (
      <EmptyState
        title="Tabela ainda vazia"
        description="A classificação aparece assim que as primeiras partidas desta competição forem registradas."
      />
    );
  }

  return (
    <div className="overflow-hidden rounded-2xl border border-line bg-surface">
      <div className="table-scroll">
        <table className="w-full min-w-[42rem] border-collapse text-sm">
          <thead>
            <tr className="border-b border-line bg-surface-2 text-[0.7rem] tracking-wider text-subtle uppercase">
              <th scope="col" className="w-12 py-3 pr-2 pl-4 text-center font-semibold">
                #
              </th>
              <th scope="col" className="py-3 text-left font-semibold">
                Clube
              </th>
              <th scope="col" className="w-12 py-3 text-center font-bold text-fg">
                P
              </th>
              <th scope="col" className="w-12 py-3 text-center font-semibold">
                J
              </th>
              <th scope="col" className="w-12 py-3 text-center font-semibold">
                V
              </th>
              <th scope="col" className="w-12 py-3 text-center font-semibold">
                E
              </th>
              <th scope="col" className="w-12 py-3 text-center font-semibold">
                D
              </th>
              {!compact ? (
                <>
                  <th scope="col" className="w-12 py-3 text-center font-semibold">
                    GP
                  </th>
                  <th scope="col" className="w-12 py-3 text-center font-semibold">
                    GC
                  </th>
                </>
              ) : null}
              <th scope="col" className="w-14 py-3 text-center font-semibold">
                SG
              </th>
              {!compact ? (
                <th scope="col" className="w-16 py-3 text-center font-semibold">
                  %
                </th>
              ) : null}
              {showForm && !compact ? (
                <th scope="col" className="w-36 py-3 pr-4 text-right font-semibold">
                  Últimos 5
                </th>
              ) : null}
            </tr>
          </thead>

          <tbody className="divide-y divide-line">
            {rows.map((row) => {
              const zone: Zone | null = zoneForPosition(row.position, zones);
              const highlighted = highlightClubId === row.club.id;

              return (
                <tr
                  key={row.club.id}
                  className={cn(
                    'group relative transition-colors',
                    highlighted ? 'bg-accent/5' : 'hover:bg-surface-2',
                  )}
                >
                  <td className="relative py-2.5 pr-2 pl-4 text-center">
                    {zone ? (
                      <span
                        className="absolute inset-y-0 left-0 w-1"
                        style={{ backgroundColor: zone.color }}
                        title={zone.label}
                        aria-label={zone.label}
                      />
                    ) : null}
                    <span className="font-mono text-sm font-bold tabular-nums">{row.position}</span>
                  </td>

                  <td className="py-2.5">
                    <Link
                      href={`/clubes/${row.club.slug}`}
                      className="flex items-center gap-2.5 transition-colors group-hover:text-accent"
                    >
                      <ClubCrest club={row.club} size={26} />
                      <span className="hidden truncate font-semibold sm:block">
                        {row.club.name}
                      </span>
                      <span className="font-semibold sm:hidden">{row.club.abbreviation}</span>
                    </Link>
                  </td>

                  <td className="py-2.5 text-center font-mono font-bold tabular-nums text-accent">
                    {row.points}
                  </td>
                  <td className="py-2.5 text-center font-mono tabular-nums text-muted">
                    {row.played}
                  </td>
                  <td className="py-2.5 text-center font-mono tabular-nums text-muted">
                    {row.won}
                  </td>
                  <td className="py-2.5 text-center font-mono tabular-nums text-muted">
                    {row.drawn}
                  </td>
                  <td className="py-2.5 text-center font-mono tabular-nums text-muted">
                    {row.lost}
                  </td>

                  {!compact ? (
                    <>
                      <td className="py-2.5 text-center font-mono tabular-nums text-muted">
                        {row.goalsFor}
                      </td>
                      <td className="py-2.5 text-center font-mono tabular-nums text-muted">
                        {row.goalsAgainst}
                      </td>
                    </>
                  ) : null}

                  <td
                    className={cn(
                      'py-2.5 text-center font-mono tabular-nums',
                      row.goalDifference > 0
                        ? 'text-win'
                        : row.goalDifference < 0
                          ? 'text-loss'
                          : 'text-muted',
                    )}
                  >
                    {formatDiff(row.goalDifference)}
                  </td>

                  {!compact ? (
                    <td className="py-2.5 text-center font-mono text-xs tabular-nums text-subtle">
                      {efficiency(row.points, row.played, pointsPerWin)}%
                    </td>
                  ) : null}

                  {showForm && !compact ? (
                    <td className="py-2.5 pr-4">
                      <div className="flex justify-end gap-1">
                        {row.form
                          ? row.form
                              .split('')
                              .map((result, index) => <FormDot key={index} result={result} />)
                          : <span className="text-xs text-subtle">—</span>}
                      </div>
                    </td>
                  ) : null}
                </tr>
              );
            })}
          </tbody>
        </table>
      </div>

      {zones.length > 0 ? (
        <div className="flex flex-wrap items-center gap-x-5 gap-y-2 border-t border-line bg-surface-2 px-4 py-3 text-xs">
          {zones.map((zone) => (
            <span key={zone.label} className="flex items-center gap-2 text-muted">
              <span
                className="size-2.5 rounded-full"
                style={{ backgroundColor: zone.color }}
                aria-hidden="true"
              />
              {zone.label}
              <span className="text-subtle">
                ({zone.fromPosition}º
                {zone.toPosition !== zone.fromPosition ? `–${zone.toPosition}º` : ''})
              </span>
            </span>
          ))}
        </div>
      ) : null}
    </div>
  );
}
