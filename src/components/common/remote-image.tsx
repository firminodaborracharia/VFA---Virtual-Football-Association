import { cn, initials } from '@/lib/utils';

/**
 * Imagem remota com fallback de iniciais.
 *
 * ── Por que NÃO usamos o otimizador do Next aqui ──
 *
 * Antes, avatares do Roblox passavam por `next/image`. Isso parece uma
 * otimização, mas o custo real é este: cada `<Image>` faz o navegador pedir
 * `/_next/image?url=…`, e é o SERVIDOR do site que então baixa a imagem do
 * rbxcdn.com. Numa página com 20 jogadores são 20 downloads que o servidor
 * precisa concluir. Se o CDN do Roblox estiver lento ou bloqueado na rede de
 * quem está rodando o projeto, essas requisições ficam pendentes e a aba do
 * navegador gira sem parar — mesmo com o HTML já entregue e o conteúdo já
 * visível na tela. Foi exatamente esse o sintoma de "carrega para sempre".
 *
 * Como as imagens em questão são escudos e avatares de 32 a 160 pixels, o
 * ganho do otimizador é irrelevante perto do risco. Servimos direto do CDN
 * com `loading="lazy"`: o navegador busca sozinho, em paralelo, e uma imagem
 * que falha é só uma imagem quebrada — não uma página travada.
 *
 * URLs livres cadastradas pelo administrador seguem o mesmo caminho, o que de
 * quebra evita transformar o otimizador do Next num proxy aberto de imagens.
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

  return (
    // Nenhuma imagem remota passa pelo otimizador do Next — ver a nota no topo
    // do arquivo e em next.config.ts.
    // eslint-disable-next-line @next/next/no-img-element
    <img
      src={src}
      alt={alt}
      width={size}
      height={size}
      loading={priority ? 'eager' : 'lazy'}
      fetchPriority={priority ? 'high' : 'auto'}
      decoding="async"
      referrerPolicy="no-referrer"
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
