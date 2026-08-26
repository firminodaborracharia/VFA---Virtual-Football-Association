'use client';

/**
 * Comemoração do campeão intercontinental — item 13 do escopo.
 *
 * Confete em CSS puro (nenhuma biblioteca, nenhuma imagem) e um troféu que
 * pulsa. Respeita `prefers-reduced-motion`: quem pediu menos movimento vê o
 * card estático, com a mesma informação.
 */

import { motion, useReducedMotion } from 'framer-motion';
import { Trophy } from 'lucide-react';
import { useMemo } from 'react';

import { ClubCrest } from '@/components/common/remote-image';

type Champion = {
  name: string;
  abbreviation: string;
  logoUrl: string | null;
  slug: string;
  leagueName?: string | null;
  nationFlag?: string | null;
};

export function ChampionCelebration({
  champion,
  title = 'Campeão Intercontinental da VFA',
  accent = '#ffb703',
}: {
  champion: Champion;
  title?: string;
  accent?: string;
}) {
  const reduceMotion = useReducedMotion();

  // Posições fixas por render, para o confete não "pular" a cada re-render.
  const confetti = useMemo(
    () =>
      Array.from({ length: 40 }, (_, index) => ({
        id: index,
        left: (index * 37) % 100,
        delay: ((index * 13) % 30) / 10,
        duration: 3 + ((index * 7) % 20) / 10,
        color: ['#ffb703', '#00e08f', '#1e6bff', '#ffffff'][index % 4],
        size: 6 + (index % 4) * 2,
      })),
    [],
  );

  return (
    <div
      className="relative overflow-hidden rounded-3xl border p-8 text-center sm:p-12"
      style={{
        borderColor: `${accent}55`,
        backgroundImage: `radial-gradient(ellipse 70% 100% at 50% 0%, ${accent}22, transparent 70%)`,
      }}
    >
      {!reduceMotion ? (
        <div className="pointer-events-none absolute inset-0 overflow-hidden" aria-hidden="true">
          {confetti.map((piece) => (
            <span
              key={piece.id}
              className="absolute top-0 block rounded-[2px]"
              style={{
                left: `${piece.left}%`,
                width: piece.size,
                height: piece.size * 1.6,
                backgroundColor: piece.color,
                opacity: 0.75,
                animation: `vfa-confetti-fall ${piece.duration}s linear ${piece.delay}s infinite`,
              }}
            />
          ))}
        </div>
      ) : null}

      <div className="relative">
        <motion.div
          initial={reduceMotion ? false : { scale: 0.6, opacity: 0, rotate: -12 }}
          animate={{ scale: 1, opacity: 1, rotate: 0 }}
          transition={{ duration: 0.6, ease: [0.22, 1, 0.36, 1] }}
          className="mx-auto flex size-16 items-center justify-center rounded-2xl"
          style={{ backgroundColor: `${accent}22`, color: accent }}
        >
          <Trophy className="size-8" />
        </motion.div>

        <motion.p
          initial={reduceMotion ? false : { y: 12, opacity: 0 }}
          animate={{ y: 0, opacity: 1 }}
          transition={{ duration: 0.5, delay: 0.15 }}
          className="mt-5 text-xs font-black tracking-[0.3em] uppercase"
          style={{ color: accent }}
        >
          {title}
        </motion.p>

        <motion.div
          initial={reduceMotion ? false : { y: 20, opacity: 0 }}
          animate={{ y: 0, opacity: 1 }}
          transition={{ duration: 0.55, delay: 0.25, ease: [0.22, 1, 0.36, 1] }}
          className="mt-6 flex flex-col items-center gap-4"
        >
          <ClubCrest club={champion} size={104} className="rounded-2xl" priority />
          <h2 className="text-3xl leading-none font-black tracking-tight sm:text-5xl">
            {champion.name}
          </h2>
          {champion.leagueName ? (
            <p className="text-sm text-muted">
              {champion.nationFlag ? `${champion.nationFlag} ` : ''}
              {champion.leagueName}
            </p>
          ) : null}
        </motion.div>
      </div>
    </div>
  );
}
