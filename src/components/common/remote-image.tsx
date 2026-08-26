import Image from 'next/image';

import { cn, initials } from '@/lib/utils';

/** Hosts que passam pelo otimizador de imagens do Next (ver next.config.ts). */
const OPTIMIZED_HOSTS = ['tr.rbxcdn.com', 'rbxcdn.com'];

function isOptimizable(url: string): boolean {
  try {
    const host = new URL(url).hostname;
    return OPTIMIZED_HOSTS.some((allowed) => host === allowed || host.endsWith(`.${allowed}`));
  } catch {
    return false;
  }
}

/**
 * Imagem remota com fallback de iniciais.
 *
 * Imagens do CDN do Roblox passam pelo otimizador; URLs livres cadastradas
 * pelo administrador usam <img> com lazy loading, para não transformar o
 * otimizador do Next num proxy aberto.
 */
export function RemoteImage({
  src,
  alt,
  fallbackText,
  size = 48,
  rounded = 'rounded-xl',
  className,
  priority = false,
}: {
  src: string | null | undefined;
  alt: string;
  fallbackText: string;
  size?: number;
  rounded?: string;
  className?: string;
  priority?: boolean;
}) {
  const shared = cn('object-cover bg-surface-2', rounded, className);

  if (!src) {
    return (
      <span
        className={cn(
          'inline-flex shrink-0 items-center justify-center border border-line bg-surface-2 font-bold text-subtle select-none',
          rounded,
          className,
        )}
        style={{ width: size, height: size, fontSize: Math.max(10, size * 0.36) }}
        aria-label={alt}
        role="img"
      >
        {initials(fallbackText)}
      </span>
    );
  }

  if (isOptimizable(src)) {
    return (
      <Image
        src={src}
        alt={alt}
        width={size}
        height={size}
        priority={priority}
        className={shared}
        style={{ width: size, height: size }}
      />
    );
  }

  return (
    // URLs livres cadastradas pelo administrador não passam pelo otimizador do
    // Next de propósito (ver next.config.ts), então aqui é <img> mesmo.
    // eslint-disable-next-line @next/next/no-img-element
    <img
      src={src}
      alt={alt}
      width={size}
      height={size}
      loading={priority ? 'eager' : 'lazy'}
      decoding="async"
      className={shared}
      style={{ width: size, height: size }}
    />
  );
}

/** Escudo do clube. */
export function ClubCrest({
  club,
  size = 40,
  className,
  priority = false,
}: {
  club: { name: string; abbreviation?: string | null; logoUrl?: string | null } | null | undefined;
  size?: number;
  className?: string;
  priority?: boolean;
}) {
  if (!club) {
    return (
      <span
        className={cn(
          'inline-flex shrink-0 items-center justify-center rounded-lg border border-dashed border-line-strong text-subtle',
          className,
        )}
        style={{ width: size, height: size, fontSize: Math.max(10, size * 0.36) }}
        aria-label="Clube a definir"
        role="img"
      >
        ?
      </span>
    );
  }

  return (
    <RemoteImage
      src={club.logoUrl}
      alt={`Escudo do ${club.name}`}
      fallbackText={club.abbreviation ?? club.name}
      size={size}
      rounded="rounded-lg"
      className={className}
      priority={priority}
    />
  );
}

/** Avatar do jogador (headshot do Roblox quando disponível). */
export function PlayerAvatar({
  player,
  size = 40,
  className,
  full = false,
  priority = false,
}: {
  player: {
    displayName: string;
    robloxHeadshotUrl?: string | null;
    robloxAvatarUrl?: string | null;
  };
  size?: number;
  className?: string;
  /** Usa o avatar de corpo inteiro em vez do headshot. */
  full?: boolean;
  priority?: boolean;
}) {
  const src = full
    ? (player.robloxAvatarUrl ?? player.robloxHeadshotUrl)
    : (player.robloxHeadshotUrl ?? player.robloxAvatarUrl);

  return (
    <RemoteImage
      src={src}
      alt={player.displayName}
      fallbackText={player.displayName}
      size={size}
      rounded="rounded-full"
      className={className}
      priority={priority}
    />
  );
}
