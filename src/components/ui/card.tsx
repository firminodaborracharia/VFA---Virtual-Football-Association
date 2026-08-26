import type { ComponentProps, ReactNode } from 'react';

import { cn } from '@/lib/utils';

/**
 * Cartão padrão do site. Duas variantes:
 *  • `default` — superfície sólida com borda discreta;
 *  • `glass`   — usada sobre o hero e banners, com desfoque.
 */
export function Card({
  className,
  variant = 'default',
  interactive = false,
  ...props
}: ComponentProps<'div'> & {
  variant?: 'default' | 'glass' | 'flat';
  interactive?: boolean;
}) {
  return (
    <div
      className={cn(
        'rounded-2xl border transition-all duration-300',
        variant === 'default' && 'border-line bg-surface shadow-card',
        variant === 'glass' && 'border-white/10 bg-white/5 backdrop-blur-xl',
        variant === 'flat' && 'border-line bg-surface-2',
        interactive &&
          'hover:-translate-y-0.5 hover:border-line-strong hover:shadow-pop motion-reduce:hover:translate-y-0',
        className,
      )}
      {...props}
    />
  );
}

export function CardHeader({
  title,
  description,
  action,
  icon,
  className,
}: {
  title: ReactNode;
  description?: ReactNode;
  action?: ReactNode;
  icon?: ReactNode;
  className?: string;
}) {
  return (
    <div
      className={cn(
        'flex items-start justify-between gap-4 border-b border-line px-5 py-4',
        className,
      )}
    >
      <div className="flex min-w-0 items-center gap-3">
        {icon ? (
          <span className="flex size-9 shrink-0 items-center justify-center rounded-xl bg-surface-2 text-accent">
            {icon}
          </span>
        ) : null}
        <div className="min-w-0">
          <h2 className="truncate text-sm font-semibold tracking-wide text-fg uppercase">
            {title}
          </h2>
          {description ? (
            <p className="mt-0.5 truncate text-xs text-muted">{description}</p>
          ) : null}
        </div>
      </div>
      {action ? <div className="shrink-0">{action}</div> : null}
    </div>
  );
}

export function CardBody({ className, ...props }: ComponentProps<'div'>) {
  return <div className={cn('p-5', className)} {...props} />;
}

export function CardFooter({ className, ...props }: ComponentProps<'div'>) {
  return (
    <div className={cn('border-t border-line px-5 py-3 text-sm text-muted', className)} {...props} />
  );
}

/** Bloco de número grande usado nos painéis de estatística. */
export function StatTile({
  label,
  value,
  hint,
  accent = false,
  className,
}: {
  label: string;
  value: ReactNode;
  hint?: ReactNode;
  accent?: boolean;
  className?: string;
}) {
  return (
    <div
      className={cn(
        'rounded-xl border border-line bg-surface-2 px-4 py-3 transition-colors',
        accent && 'border-accent/40 bg-accent/5',
        className,
      )}
    >
      <div className="text-[0.7rem] font-medium tracking-widest text-subtle uppercase">{label}</div>
      <div
        className={cn(
          'mt-1 font-mono text-2xl leading-none font-bold tabular-nums',
          accent ? 'text-accent' : 'text-fg',
        )}
      >
        {value}
      </div>
      {hint ? <div className="mt-1 text-xs text-muted">{hint}</div> : null}
    </div>
  );
}
