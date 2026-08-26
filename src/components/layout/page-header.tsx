import type { ReactNode } from 'react';

import { cn } from '@/lib/utils';

/** Cabeçalho padrão das páginas internas. */
export function PageHeader({
  eyebrow,
  title,
  description,
  actions,
  media,
  accent,
  className,
}: {
  eyebrow?: ReactNode;
  title: ReactNode;
  description?: ReactNode;
  actions?: ReactNode;
  media?: ReactNode;
  /** Cor de destaque da liga/competição, quando houver. */
  accent?: string | null;
  className?: string;
}) {
  return (
    <header
      className={cn('relative overflow-hidden border-b border-line', className)}
      style={
        accent
          ? {
              backgroundImage: `radial-gradient(ellipse 60% 100% at 0% 0%, ${accent}1f, transparent 70%)`,
            }
          : undefined
      }
    >
      <div className="container-vfa py-10 sm:py-14">
        <div className="flex flex-col gap-6 md:flex-row md:items-end md:justify-between">
          <div className="flex min-w-0 items-center gap-5">
            {media}
            <div className="min-w-0">
              {eyebrow ? (
                <p className="text-xs font-bold tracking-[0.2em] text-accent uppercase">{eyebrow}</p>
              ) : null}
              <h1 className="animate-fade-up mt-1.5 text-3xl leading-tight font-black tracking-tight sm:text-4xl lg:text-5xl">
                {title}
              </h1>
              {description ? (
                <div className="mt-2.5 max-w-2xl text-sm text-muted sm:text-base">{description}</div>
              ) : null}
            </div>
          </div>

          {actions ? <div className="flex shrink-0 flex-wrap gap-2">{actions}</div> : null}
        </div>
      </div>
    </header>
  );
}
