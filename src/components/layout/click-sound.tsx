'use client';

import { useEffect, useRef } from 'react';

/**
 * Som curto ao clicar em botões e links.
 *
 * ── Por que não um arquivo de áudio ──
 *
 * Um "toc" de clique dura 60 milissegundos. Servi-lo como arquivo custaria uma
 * requisição de rede, mais alguns KB, mais a latência do primeiro clique
 * enquanto o arquivo chega — para um som que ninguém repara. Aqui ele é
 * SINTETIZADO na hora com a Web Audio API: dois osciladores e um envelope de
 * volume, zero bytes baixados, zero espera.
 *
 * ── Por que um ouvinte só, no documento ──
 *
 * A alternativa seria pôr `onClick` em cada botão do site. Seriam dezenas de
 * lugares para lembrar, e todo componente novo nasceria mudo. Um único ouvinte
 * na fase de captura ouve tudo que acontece na página, inclusive em botões que
 * ainda nem existem.
 *
 * ── Por que só depois do primeiro clique ──
 *
 * O navegador não deixa criar um contexto de áudio antes de um gesto do
 * usuário. O contexto é criado no primeiro clique — que por isso sai mudo — e
 * todos os seguintes tocam. É a mesma regra que rege a música do disco.
 */

/** Elementos que fazem som. Um clique no vazio da página não faz nada. */
const INTERACTIVE = 'button, a[href], [role="button"], summary, input[type="checkbox"]';

const STORAGE_KEY = 'vfa:sound:off';

export function ClickSound() {
  const contextRef = useRef<AudioContext | null>(null);

  useEffect(() => {
    // Respeita quem pediu menos animação e movimento no sistema: essa
    // preferência costuma acompanhar sensibilidade a estímulo em geral.
    const quiet = window.matchMedia?.('(prefers-reduced-motion: reduce)').matches;
    if (quiet) return;

    function isMuted(): boolean {
      try {
        return window.localStorage.getItem(STORAGE_KEY) === 'true';
      } catch {
        return false;
      }
    }

    function play(pressed: Element) {
      if (isMuted()) return;

      type WithWebkit = typeof window & { webkitAudioContext?: typeof AudioContext };
      const Ctor = window.AudioContext ?? (window as WithWebkit).webkitAudioContext;
      if (!Ctor) return;

      contextRef.current ??= new Ctor();
      const ctx = contextRef.current;

      // O contexto pode nascer suspenso; o clique atual é o gesto que libera.
      if (ctx.state === 'suspended') void ctx.resume();

      const now = ctx.currentTime;

      /**
       * Links e botões secundários recebem uma nota mais grave que o botão
       * principal. Não é enfeite: dá um retorno diferente para "naveguei" e
       * para "acionei a ação principal desta tela".
       */
      const primary = pressed.classList.contains('bg-accent');
      const base = primary ? 660 : 440;

      const oscillator = ctx.createOscillator();
      const gain = ctx.createGain();

      oscillator.type = 'triangle';
      oscillator.frequency.setValueAtTime(base, now);
      // Queda rápida de tom: é o que transforma um bipe em "toc".
      oscillator.frequency.exponentialRampToValueAtTime(base * 0.6, now + 0.05);

      // Volume baixo de propósito. Som de interface que se faz notar cansa em
      // cinco minutos de navegação.
      gain.gain.setValueAtTime(0.0001, now);
      gain.gain.exponentialRampToValueAtTime(0.06, now + 0.005);
      gain.gain.exponentialRampToValueAtTime(0.0001, now + 0.07);

      oscillator.connect(gain).connect(ctx.destination);
      oscillator.start(now);
      oscillator.stop(now + 0.08);
    }

    function onPointerDown(event: MouseEvent) {
      const target = event.target as Element | null;
      const pressed = target?.closest?.(INTERACTIVE);
      if (pressed) play(pressed);
    }

    // Captura, não bolha: o som sai junto com o clique mesmo que algum
    // componente interrompa a propagação do evento.
    document.addEventListener('pointerdown', onPointerDown, { capture: true });
    return () => document.removeEventListener('pointerdown', onPointerDown, { capture: true });
  }, []);

  return null;
}
