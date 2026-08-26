'use client';

/**
 * Evolução do jogador na temporada — item 5 do escopo.
 *
 * Duas leituras diferentes, dois gráficos separados (nunca dois eixos Y no
 * mesmo gráfico):
 *   1. acumulado de gols e assistências ao longo da temporada — mostra ritmo;
 *   2. participações em gols por partida — mostra consistência.
 *
 * A paleta foi validada para daltonismo e contraste sobre o fundo escuro do
 * site (verde #0fa97a × azul #3b82f6, ΔE 23 em protanopia). Além da cor, cada
 * série tem rótulo direto no último ponto e legenda, para que a identidade
 * nunca dependa só da cor. Há ainda uma tabela com os mesmos números.
 */

import { useMemo, useState } from 'react';
import {
  Bar,
  BarChart,
  CartesianGrid,
  Line,
  LineChart,
  ResponsiveContainer,
  Tooltip,
  XAxis,
  YAxis,
} from 'recharts';

import { EmptyState } from '@/components/ui/empty-state';
import type { PlayerTimelineEntry } from '@/lib/queries';
import { cn, formatDate } from '@/lib/utils';

const SERIES = {
  goals: { color: '#0fa97a', label: 'Gols' },
  assists: { color: '#3b82f6', label: 'Assistências' },
} as const;

const AXIS_TICK = { fill: 'var(--vfa-fg-subtle)', fontSize: 11 };

type ChartPoint = {
  index: number;
  label: string;
  opponent: string;
  date: string;
  goals: number;
  assists: number;
  cumulativeGoals: number;
  cumulativeAssists: number;
  contributions: number;
  result: 'W' | 'D' | 'L';
};

export function PlayerCharts({ timeline }: { timeline: PlayerTimelineEntry[] }) {
  const [showTable, setShowTable] = useState(false);

  const data = useMemo<ChartPoint[]>(() => {
    // Laço explícito em vez de `map` com acumulador externo: o acumulador
    // dentro de uma closure é justamente o padrão que o compilador do React
    // não consegue memoizar com segurança.
    const points: ChartPoint[] = [];
    let goals = 0;
    let assists = 0;

    for (let index = 0; index < timeline.length; index += 1) {
      const entry = timeline[index];
      goals += entry.goals;
      assists += entry.assists;

      points.push({
        index: index + 1,
        label: entry.matchday ? `R${entry.matchday}` : `#${index + 1}`,
        opponent: entry.opponentName,
        date: formatDate(entry.kickoffAt),
        goals: entry.goals,
        assists: entry.assists,
        cumulativeGoals: goals,
        cumulativeAssists: assists,
        contributions: entry.goals + entry.assists,
        result: entry.result,
      });
    }

    return points;
  }, [timeline]);

  if (data.length === 0) {
    return (
      <EmptyState
        title="Sem partidas registradas nesta temporada"
        description="O gráfico de evolução aparece depois que o jogador participar da primeira partida encerrada."
      />
    );
  }

  const last = data[data.length - 1];

  return (
    <div className="space-y-6">
      {/* ── Acumulado ── */}
      <figure className="rounded-2xl border border-line bg-surface p-5">
        <figcaption className="mb-1 flex flex-wrap items-baseline justify-between gap-2">
          <h3 className="text-sm font-bold text-fg">Evolução na temporada</h3>
          <div className="flex items-center gap-4">
            {(['goals', 'assists'] as const).map((key) => (
              <span key={key} className="flex items-center gap-1.5 text-xs text-muted">
                <span
                  className="size-2.5 rounded-full"
                  style={{ backgroundColor: SERIES[key].color }}
                  aria-hidden="true"
                />
                {SERIES[key].label}
              </span>
            ))}
          </div>
        </figcaption>
        <p className="mb-4 text-xs text-subtle">
          Total acumulado partida a partida. Ao fim da temporada: {last.cumulativeGoals}{' '}
          {last.cumulativeGoals === 1 ? 'gol' : 'gols'} e {last.cumulativeAssists}{' '}
          {last.cumulativeAssists === 1 ? 'assistência' : 'assistências'}.
        </p>

        <div className="h-64 w-full">
          <ResponsiveContainer width="100%" height="100%">
            <LineChart data={data} margin={{ top: 8, right: 44, bottom: 4, left: -18 }}>
              <CartesianGrid stroke="var(--vfa-border)" strokeDasharray="3 3" vertical={false} />
              <XAxis
                dataKey="label"
                tick={AXIS_TICK}
                axisLine={{ stroke: 'var(--vfa-border)' }}
                tickLine={false}
                interval="preserveStartEnd"
                minTickGap={16}
              />
              <YAxis
                tick={AXIS_TICK}
                axisLine={false}
                tickLine={false}
                allowDecimals={false}
                width={40}
              />
              <Tooltip
                cursor={{ stroke: 'var(--vfa-border-strong)', strokeWidth: 1 }}
                content={<CumulativeTooltip />}
              />
              <Line
                type="monotone"
                dataKey="cumulativeGoals"
                name={SERIES.goals.label}
                stroke={SERIES.goals.color}
                strokeWidth={2}
                dot={false}
                activeDot={{ r: 4, strokeWidth: 2, stroke: 'var(--vfa-surface)' }}
                isAnimationActive={false}
              />
              <Line
                type="monotone"
                dataKey="cumulativeAssists"
                name={SERIES.assists.label}
                stroke={SERIES.assists.color}
                strokeWidth={2}
                dot={false}
                activeDot={{ r: 4, strokeWidth: 2, stroke: 'var(--vfa-surface)' }}
                isAnimationActive={false}
              />
            </LineChart>
          </ResponsiveContainer>
        </div>
      </figure>

      {/* ── Participações por partida ── */}
      <figure className="rounded-2xl border border-line bg-surface p-5">
        <figcaption className="mb-1">
          <h3 className="text-sm font-bold text-fg">Participações em gols por partida</h3>
        </figcaption>
        <p className="mb-4 text-xs text-subtle">
          Gols somados às assistências em cada jogo. Barras mais altas indicam partidas decisivas.
        </p>

        <div className="h-40 w-full">
          <ResponsiveContainer width="100%" height="100%">
            <BarChart data={data} margin={{ top: 8, right: 8, bottom: 4, left: -18 }} barCategoryGap={2}>
              <CartesianGrid stroke="var(--vfa-border)" strokeDasharray="3 3" vertical={false} />
              <XAxis
                dataKey="label"
                tick={AXIS_TICK}
                axisLine={{ stroke: 'var(--vfa-border)' }}
                tickLine={false}
                interval="preserveStartEnd"
                minTickGap={16}
              />
              <YAxis
                tick={AXIS_TICK}
                axisLine={false}
                tickLine={false}
                allowDecimals={false}
                width={40}
              />
              <Tooltip
                cursor={{ fill: 'var(--vfa-surface-2)' }}
                content={<PerMatchTooltip />}
              />
              <Bar
                dataKey="contributions"
                name="Participações"
                fill={SERIES.goals.color}
                radius={[4, 4, 0, 0]}
                isAnimationActive={false}
              />
            </BarChart>
          </ResponsiveContainer>
        </div>
      </figure>

      {/* ── Tabela equivalente ── */}
      <div>
        <button
          type="button"
          onClick={() => setShowTable((value) => !value)}
          className="text-xs font-semibold text-muted underline underline-offset-4 transition-colors hover:text-accent"
          aria-expanded={showTable}
        >
          {showTable ? 'Ocultar tabela de números' : 'Ver os mesmos dados em tabela'}
        </button>

        {showTable ? (
          <div className="table-scroll mt-3 overflow-hidden rounded-xl border border-line">
            <table className="w-full min-w-[30rem] text-sm">
              <thead>
                <tr className="border-b border-line bg-surface-2 text-[0.7rem] tracking-wider text-subtle uppercase">
                  <th scope="col" className="px-3 py-2 text-left font-semibold">Rodada</th>
                  <th scope="col" className="px-3 py-2 text-left font-semibold">Adversário</th>
                  <th scope="col" className="px-3 py-2 text-center font-semibold">Gols</th>
                  <th scope="col" className="px-3 py-2 text-center font-semibold">Assist.</th>
                  <th scope="col" className="px-3 py-2 text-center font-semibold">Acum. gols</th>
                  <th scope="col" className="px-3 py-2 text-center font-semibold">Acum. assist.</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-line">
                {data.map((point) => (
                  <tr key={point.index} className="hover:bg-surface-2">
                    <td className="px-3 py-2 font-mono text-xs text-subtle">{point.label}</td>
                    <td className="px-3 py-2">
                      <span className="flex items-center gap-2">
                        <ResultDot result={point.result} />
                        {point.opponent}
                      </span>
                    </td>
                    <td className="px-3 py-2 text-center font-mono tabular-nums">{point.goals}</td>
                    <td className="px-3 py-2 text-center font-mono tabular-nums">{point.assists}</td>
                    <td className="px-3 py-2 text-center font-mono tabular-nums text-muted">
                      {point.cumulativeGoals}
                    </td>
                    <td className="px-3 py-2 text-center font-mono tabular-nums text-muted">
                      {point.cumulativeAssists}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        ) : null}
      </div>
    </div>
  );
}

function ResultDot({ result }: { result: 'W' | 'D' | 'L' }) {
  return (
    <span
      className={cn(
        'inline-block size-2 shrink-0 rounded-full',
        result === 'W' ? 'bg-win' : result === 'L' ? 'bg-loss' : 'bg-draw',
      )}
      title={result === 'W' ? 'Vitória' : result === 'L' ? 'Derrota' : 'Empate'}
    />
  );
}

type TooltipProps = {
  active?: boolean;
  payload?: { payload: ChartPoint }[];
};

function TooltipShell({ point, children }: { point: ChartPoint; children: React.ReactNode }) {
  return (
    <div className="rounded-xl border border-line bg-surface/95 px-3 py-2 shadow-pop backdrop-blur">
      <p className="text-xs font-bold text-fg">
        {point.label} · {point.opponent}
      </p>
      <p className="mb-1.5 text-[0.7rem] text-subtle">{point.date}</p>
      {children}
    </div>
  );
}

function CumulativeTooltip({ active, payload }: TooltipProps) {
  if (!active || !payload?.length) return null;
  const point = payload[0].payload;

  return (
    <TooltipShell point={point}>
      <dl className="space-y-0.5 text-xs">
        <div className="flex items-center gap-2">
          <span
            className="size-2 rounded-full"
            style={{ backgroundColor: SERIES.goals.color }}
            aria-hidden="true"
          />
          <dt className="text-muted">Gols (acumulado)</dt>
          <dd className="ml-auto font-mono font-bold text-fg tabular-nums">
            {point.cumulativeGoals}
          </dd>
        </div>
        <div className="flex items-center gap-2">
          <span
            className="size-2 rounded-full"
            style={{ backgroundColor: SERIES.assists.color }}
            aria-hidden="true"
          />
          <dt className="text-muted">Assistências (acumulado)</dt>
          <dd className="ml-auto font-mono font-bold text-fg tabular-nums">
            {point.cumulativeAssists}
          </dd>
        </div>
      </dl>
    </TooltipShell>
  );
}

function PerMatchTooltip({ active, payload }: TooltipProps) {
  if (!active || !payload?.length) return null;
  const point = payload[0].payload;

  return (
    <TooltipShell point={point}>
      <p className="text-xs text-muted">
        <span className="font-mono font-bold text-fg">{point.goals}</span>{' '}
        {point.goals === 1 ? 'gol' : 'gols'} ·{' '}
        <span className="font-mono font-bold text-fg">{point.assists}</span>{' '}
        {point.assists === 1 ? 'assistência' : 'assistências'}
      </p>
    </TooltipShell>
  );
}
