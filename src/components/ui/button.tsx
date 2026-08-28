import Link from 'next/link';
import type { ComponentProps, ReactNode } from 'react';

import { cn } from '@/lib/utils';

type Variant = 'primary' | 'secondary' | 'ghost' | 'danger' | 'outline';
type Size = 'sm' | 'md' | 'lg';

const base =
  'inline-flex items-center justify-center gap-2 rounded-xl font-semibold transition-all duration-200 ' +
  'disabled:pointer-events-none disabled:opacity-50 focus-visible:outline-2 focus-visible:outline-offset-2 ' +
  'focus-visible:outline-accent active:scale-[0.98] motion-reduce:active:scale-100 whitespace-nowrap';

/**
 * Botões de vidro.
 *
 * `primary` é a única exceção que continua sólida — e de propósito. Se o botão
 * principal também fosse translúcido, ele teria o mesmo peso visual dos
 * outros, e a página perderia o ponto para onde o olho deve ir primeiro.
 * Transparência em tudo é o mesmo que transparência em nada.
 *
 * Os demais ganham `glass-*`: contorno visível, preenchimento quase ausente,
 * e o fundo do site aparecendo através deles.
 */
const variants: Record<Variant, string> = {
  primary:
    'bg-accent text-black hover:brightness-110 shadow-[0_6px_24px_-8px_var(--vfa-accent)] hover:shadow-[0_10px_30px_-8px_var(--vfa-accent)]',
  secondary: 'glass-button text-fg hover:bg-fg/12',
  outline: 'glass-accent hover:brightness-125',
  ghost: 'text-muted hover:bg-fg/8 hover:text-fg',
  danger: 'bg-loss/85 text-white backdrop-blur-md hover:bg-loss',
};

const sizes: Record<Size, string> = {
  sm: 'h-8 px-3 text-xs',
  md: 'h-10 px-4 text-sm',
  lg: 'h-12 px-6 text-base',
};

export function buttonClass(variant: Variant = 'primary', size: Size = 'md', className?: string) {
  return cn(base, variants[variant], sizes[size], className);
}

export function Button({
  variant = 'primary',
  size = 'md',
  className,
  loading = false,
  children,
  ...props
}: ComponentProps<'button'> & { variant?: Variant; size?: Size; loading?: boolean }) {
  return (
    <button
      className={buttonClass(variant, size, className)}
      disabled={props.disabled || loading}
      {...props}
    >
      {loading ? <Spinner /> : null}
      {children}
    </button>
  );
}

export function ButtonLink({
  variant = 'primary',
  size = 'md',
  className,
  children,
  ...props
}: ComponentProps<typeof Link> & { variant?: Variant; size?: Size; children?: ReactNode }) {
  return (
    <Link className={buttonClass(variant, size, className)} {...props}>
      {children}
    </Link>
  );
}

export function Spinner({ className }: { className?: string }) {
  return (
    <svg
      className={cn('size-4 animate-spin', className)}
      viewBox="0 0 24 24"
      fill="none"
      aria-hidden="true"
    >
      <circle cx="12" cy="12" r="10" stroke="currentColor" strokeOpacity="0.25" strokeWidth="3" />
      <path
        d="M22 12a10 10 0 0 0-10-10"
        stroke="currentColor"
        strokeWidth="3"
        strokeLinecap="round"
      />
    </svg>
  );
}
