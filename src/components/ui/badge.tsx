import type { ComponentProps } from 'react';

import { cn } from '@/lib/utils';

type Tone = 'neutral' | 'accent' | 'win' | 'draw' | 'loss' | 'live' | 'warn';

const tones: Record<Tone, string> = {
  neutral: 'bg-surface-3 text-muted border-line-strong',
  accent: 'bg-accent/10 text-accent border-accent/30',
  win: 'bg-win/10 text-win border-win/30',
  draw: 'bg-draw/10 text-draw border-draw/30',
  loss: 'bg-loss/10 text-loss border-loss/30',
  live: 'bg-live/10 text-live border-live/40',
  warn: 'bg-accent-warm/10 text-accent-warm border-accent-warm/30',
};

export function Badge({
  tone = 'neutral',
  className,
  ...props
}: ComponentProps<'span'> & { tone?: Tone }) {
  return (
    <span
      className={cn(
        'inline-flex items-center gap-1.5 rounded-full border px-2.5 py-0.5 text-[0.7rem] font-semibold tracking-wide uppercase',
        tones[tone],
        className,
      )}
      {...props}
    />
  );
}

/** Selo "AO VIVO" com ponto pulsante. */
export function LiveBadge({ className }: { className?: string }) {
  return (
    <Badge tone="live" className={className}>
      <span className="size-1.5 animate-pulse-live rounded-full bg-live" />
      Ao vivo
    </Badge>
  );
}

/** Bolinha de resultado usada na coluna de forma da tabela. */
export function FormDot({ result }: { result: 'W' | 'D' | 'L' | string }) {
  const map: Record<string, { className: string; label: string }> = {
    W: { className: 'bg-win/20 text-win border-win/40', label: 'V' },
    D: { className: 'bg-draw/20 text-draw border-draw/40', label: 'E' },
    L: { className: 'bg-loss/20 text-loss border-loss/40', label: 'D' },
  };
  const style = map[result] ?? { className: 'bg-surface-3 text-subtle border-line', label: '–' };

  return (
    <span
      className={cn(
        'inline-flex size-5 items-center justify-center rounded-md border text-[0.65rem] font-bold',
        style.className,
      )}
      title={result === 'W' ? 'Vitória' : result === 'D' ? 'Empate' : 'Derrota'}
    >
      {style.label}
    </span>
  );
}

/** Marcador colorido da zona de classificação, na primeira coluna da tabela. */
export function ZoneMarker({ color, label }: { color: string; label: string }) {
  return (
    <span
      className="absolute inset-y-0 left-0 w-1 rounded-r"
      style={{ backgroundColor: color }}
      title={label}
      aria-label={label}
    />
  );
}
