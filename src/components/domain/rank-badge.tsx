import { rankFor } from '@/lib/ranks';
import { cn } from '@/lib/utils';

/**
 * Selo de rank do jogador.
 *
 * A cor vem da faixa e entra por `style`, não por classe do Tailwind. Não é
 * descuido: as cores estão em `src/lib/ranks.ts` para que acrescentar ou
 * mudar uma faixa seja editar uma linha de dado. Se fossem classes, o Tailwind
 * precisaria enxergar cada uma no código-fonte para gerá-las, e uma faixa nova
 * sairia sem cor nenhuma.
 */
export function RankBadge({
  overall,
  size = 'md',
  showOverall = true,
  className,
}: {
  overall: number | null | undefined;
  size?: 'sm' | 'md' | 'lg';
  showOverall?: boolean;
  className?: string;
}) {
  const rank = rankFor(overall);

  // Sem nota cadastrada não há selo. Mostrar "Sem rank" em toda lista seria
  // encher a tela com a ausência de um dado que o administrador ainda vai
  // preencher.
  if (!rank) return null;

  const sizes = {
    sm: 'h-5 gap-1 px-1.5 text-[0.6rem]',
    md: 'h-6 gap-1.5 px-2 text-[0.68rem]',
    lg: 'h-8 gap-2 px-3 text-sm',
  };

  return (
    <span
      className={cn(
        'inline-flex shrink-0 items-center rounded-md border font-extrabold tracking-wide uppercase',
        sizes[size],
        className,
      )}
      style={{
        color: rank.color,
        borderColor: `color-mix(in oklab, ${rank.color} 45%, transparent)`,
        backgroundColor: `color-mix(in oklab, ${rank.color} 14%, transparent)`,
      }}
      title={`${rank.label} — overall ${overall}`}
    >
      <span
        className="scoreboard flex size-4 items-center justify-center rounded-sm text-[0.65rem] text-black"
        style={{ backgroundColor: rank.color }}
        aria-hidden
      >
        {rank.badge}
      </span>
      {rank.label}
      {showOverall ? <span className="scoreboard opacity-80">{overall}</span> : null}
    </span>
  );
}
