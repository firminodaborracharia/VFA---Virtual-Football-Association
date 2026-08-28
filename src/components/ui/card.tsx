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
        'rounded-2xl transition-all duration-300',
        // O cartão padrão passou a ser de vidro. O fundo do site tem refletor
        // e faixas de gramado, e é isso que a translucidez revela — a mesma
        // classe sobre um fundo chapado não teria efeito nenhum.
        variant === 'default' && 'glass',
        variant === 'glass' && 'glass',
        // `flat` é a variante para conteúdo denso: tabela, lista longa, texto
        // miúdo. Ali o vidro atrapalha a leitura em vez de ajudar.
        variant === 'flat' && 'glass-solid',
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
          /* Quadrado com canto cortado, não um círculo suave: o mesmo desenho
             do escudo no cabeçalho, repetido em escala menor. */
          <span
            className="flex size-9 shrink-0 items-center justify-center bg-surface-2 text-accent"
            style={{ clipPath: 'polygon(0 0, 100% 0, 100% 76%, 50% 100%, 0 76%)' }}
          >
            {icon}
          </span>
        ) : null}
        <div className="min-w-0">
          <h2 className="truncate text-[0.8rem] font-extrabold tracking-[0.1em] text-fg uppercase">
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
      <div className="text-[0.65rem] font-extrabold tracking-[0.16em] text-subtle uppercase">
        {label}
      </div>
      <div
        className={cn(
          // `scoreboard` em vez de fonte monoespaçada: o número fica pesado e
          // apertado como placar, sem o ar de terminal que o mono dava.
          'scoreboard mt-1.5 text-3xl leading-none',
          accent ? 'text-accent' : 'text-fg',
        )}
      >
        {value}
      </div>
      {hint ? <div className="mt-1 text-xs text-muted">{hint}</div> : null}
    </div>
  );
}
