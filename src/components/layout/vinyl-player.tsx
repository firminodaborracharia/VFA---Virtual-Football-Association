'use client';

import { Music, Pause, Play, Volume2, VolumeX } from 'lucide-react';
import { useEffect, useRef, useState, useSyncExternalStore } from 'react';

import { cn, DEFAULT_CREST } from '@/lib/utils';

/**
 * Disco de vinil no canto da tela.
 *
 * ── Sobre o áudio ──
 *
 * Nenhum arquivo de música vem no projeto. Faixa comercial tem dono, e
 * empacotar uma junto do código faria de cada deploy uma cópia não
 * autorizada. O endereço é configurado no painel (`/admin/configuracoes`) e
 * aponta para um arquivo que o administrador tem direito de usar.
 *
 * ── Sobre tocar sozinho ──
 *
 * Não toca. Chrome, Safari e Firefox bloqueiam áudio automático desde 2018 —
 * `play()` sem um clique anterior devolve uma promessa rejeitada. Um site que
 * "tenta" tocar sozinho não fica mais musical: fica com um botão em estado
 * mentiroso, mostrando pausa enquanto nada sai. Aqui o disco gira desde o
 * início como elemento visual, e o som espera o clique.
 *
 * ── Sobre lembrar a escolha ──
 *
 * Volume e mudo ficam em `localStorage`. Já o "estava tocando" não é
 * restaurado: retomar a música sozinha na segunda visita esbarra na mesma
 * regra do navegador e assusta quem abriu o site no meio de uma reunião.
 */

const VOLUME_KEY = 'vfa:player:volume';
const MUTED_KEY = 'vfa:player:muted';

export type PlayerTrack = {
  url: string;
  title: string;
  artist: string;
};

const DEFAULT_PREFS = { volume: 0.6, muted: false };

/** Nunca notifica: o valor só muda por ação do próprio usuário nesta aba. */
const noSubscribe = () => () => {};

function readPrefs(): { volume: number; muted: boolean } {
  try {
    const rawVolume = window.localStorage.getItem(VOLUME_KEY);
    const rawMuted = window.localStorage.getItem(MUTED_KEY);
    const parsed = Number(rawVolume);

    return {
      volume:
        rawVolume !== null && Number.isFinite(parsed) && parsed >= 0 && parsed <= 1
          ? parsed
          : DEFAULT_PREFS.volume,
      muted: rawMuted === 'true',
    };
  } catch {
    // Navegação privada ou armazenamento bloqueado.
    return DEFAULT_PREFS;
  }
}

export function VinylPlayer({ track }: { track: PlayerTrack }) {
  const audioRef = useRef<HTMLAudioElement | null>(null);

  const [playing, setPlaying] = useState(false);
  const [expanded, setExpanded] = useState(false);
  const [broken, setBroken] = useState(false);

  /**
   * Preferências salvas, sem `setState` dentro de efeito.
   *
   * O caminho óbvio — ler o `localStorage` num `useEffect` e chamar `setState`
   * — é justamente o que o React Compiler proíbe, e com razão: provoca uma
   * segunda renderização logo depois da primeira, toda vez.
   *
   * `useSyncExternalStore` resolve o problema de hidratação: no servidor
   * devolve `false`, no cliente `true`. Antes de hidratar usamos os padrões,
   * que é exatamente o que o HTML do servidor contém — nenhuma divergência. Só
   * depois o valor guardado entra, durante a renderização, sem efeito nenhum.
   */
  const hydrated = useSyncExternalStore(
    noSubscribe,
    () => true,
    () => false,
  );

  const [override, setOverride] = useState<{ volume: number; muted: boolean } | null>(null);
  const prefs = override ?? (hydrated ? readPrefs() : DEFAULT_PREFS);
  const { volume, muted } = prefs;

  function updatePrefs(next: { volume: number; muted: boolean }) {
    setOverride(next);
    try {
      window.localStorage.setItem(VOLUME_KEY, String(next.volume));
      window.localStorage.setItem(MUTED_KEY, String(next.muted));
    } catch {
      // Sem persistência: a sessão atual continua funcionando.
    }
  }

  // Espelha as preferências no elemento de áudio. Este efeito não chama
  // `setState`: apenas escreve numa propriedade do DOM, que é para o que
  // efeitos servem.
  useEffect(() => {
    const audio = audioRef.current;
    if (!audio) return;
    audio.volume = volume;
    audio.muted = muted;
  }, [volume, muted]);

  async function toggle() {
    const audio = audioRef.current;
    if (!audio || broken) return;

    if (playing) {
      audio.pause();
      setPlaying(false);
      return;
    }

    try {
      await audio.play();
      setPlaying(true);
    } catch {
      // O clique existiu, então o bloqueio de autoplay não é a causa: ou o
      // arquivo não carregou, ou o formato não é suportado.
      setBroken(true);
      setPlaying(false);
    }
  }

  const hasTrack = track.url.trim().length > 0;
  const label = hasTrack ? (track.title || 'Trilha da VFA') : 'Nenhuma trilha configurada';

  return (
    <div
      className="fixed right-4 bottom-4 z-40 flex items-center gap-0 sm:right-6 sm:bottom-6"
      onMouseEnter={() => setExpanded(true)}
      onMouseLeave={() => setExpanded(false)}
    >
      {/*
        Painel que desliza para fora do disco.

        Fica à ESQUERDA porque o disco está encostado na borda direita: abrir
        para o lado de fora empurraria o conteúdo para fora da tela.
      */}
      <div
        className={cn(
          'glass mr-[-14px] flex items-center gap-3 overflow-hidden rounded-l-full py-2 pr-6 pl-4 transition-all duration-300',
          expanded && hasTrack && !broken
            ? 'max-w-[19rem] opacity-100'
            : 'pointer-events-none max-w-0 opacity-0',
        )}
        aria-hidden={!expanded}
      >
        <div className="min-w-0">
          <p className="truncate text-xs font-bold text-fg">{label}</p>
          {track.artist ? (
            <p className="truncate text-[0.7rem] text-muted">{track.artist}</p>
          ) : null}
        </div>

        <button
          type="button"
          onClick={() => updatePrefs({ volume, muted: !muted })}
          className="shrink-0 text-muted transition-colors hover:text-accent"
          aria-label={muted ? 'Ativar som' : 'Silenciar'}
        >
          {muted ? <VolumeX className="size-4" /> : <Volume2 className="size-4" />}
        </button>

        <input
          type="range"
          min={0}
          max={1}
          step={0.05}
          value={volume}
          onChange={(event) => updatePrefs({ volume: Number(event.target.value), muted })}
          className="h-1 w-16 shrink-0 cursor-pointer appearance-none rounded-full bg-line-strong accent-[var(--vfa-accent)]"
          aria-label="Volume"
        />
      </div>

      {/* ── O disco ── */}
      <button
        type="button"
        onClick={toggle}
        disabled={!hasTrack || broken}
        className={cn(
          'group relative size-16 shrink-0 rounded-full transition-transform duration-300',
          // Aro de menta: sem ele o disco preto some no fundo preto e vira uma
          // mancha sem forma. É o contorno que faz o objeto existir.
          'ring-1 ring-accent/45 ring-offset-2 ring-offset-bg',
          'focus-visible:outline-2 focus-visible:outline-offset-4 focus-visible:outline-accent',
          hasTrack && !broken ? 'cursor-pointer hover:ring-accent/80 hover:scale-105' : 'cursor-default',
        )}
        aria-label={
          !hasTrack || broken
            ? label
            : playing
              ? `Pausar ${track.title || 'a trilha'}`
              : `Tocar ${track.title || 'a trilha'}`
        }
        title={label}
      >
        {/*
          Sulcos do vinil em gradiente repetido, sem imagem nenhuma.

          A camada gira; o rótulo central e o ícone ficam fora dela, senão o
          escudo giraria junto e o botão de pausa ficaria ilegível.
        */}
        <span
          className={cn(
            'absolute inset-0 rounded-full',
            'shadow-[0_10px_30px_-8px_rgb(0_0_0/0.8),inset_0_0_0_1px_color-mix(in_oklab,var(--vfa-fg)_14%,transparent)]',
            'animate-vinyl',
            !playing && 'animate-vinyl-slow',
          )}
          style={{
            background: `
              repeating-radial-gradient(
                circle at 50% 50%,
                #0b0f0e 0 2px,
                #14201c 2px 3px
              ),
              radial-gradient(circle at 32% 28%, rgb(255 255 255 / 0.16), transparent 42%)
            `,
          }}
          aria-hidden
        />

        {/* Rótulo central com o escudo. */}
        <span className="glass absolute inset-[30%] flex items-center justify-center rounded-full">
          {/* eslint-disable-next-line @next/next/no-img-element */}
          <img src={DEFAULT_CREST} alt="" className="size-full rounded-full object-cover" />
        </span>

        {/* Furo do disco. */}
        <span
          className="absolute top-1/2 left-1/2 size-1.5 -translate-x-1/2 -translate-y-1/2 rounded-full bg-bg"
          aria-hidden
        />

        {/* Estado, revelado no hover ou enquanto toca. */}
        <span
          className={cn(
            'absolute inset-0 flex items-center justify-center rounded-full text-accent transition-opacity duration-200',
            hasTrack && !broken
              ? 'bg-black/60 opacity-0 group-hover:opacity-100 group-focus-visible:opacity-100'
              // Sem trilha, o ícone fica visível mas sem véu por cima: o disco
              // continua sendo um disco, não um botão apagado.
              : 'bg-black/35 opacity-100',
          )}
          aria-hidden
        >
          {!hasTrack || broken ? (
            <Music className="size-5 text-subtle" />
          ) : playing ? (
            <Pause className="size-5" />
          ) : (
            <Play className="size-5 translate-x-px" />
          )}
        </span>
      </button>

      {hasTrack ? (
        <audio
          ref={audioRef}
          src={track.url}
          loop
          preload="none"
          onError={() => setBroken(true)}
          onEnded={() => setPlaying(false)}
          onPause={() => setPlaying(false)}
          onPlay={() => setPlaying(true)}
        />
      ) : null}
    </div>
  );
}
