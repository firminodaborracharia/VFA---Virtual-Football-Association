'use client';

import { Check, Globe } from 'lucide-react';
import { useRouter } from 'next/navigation';
import { useState } from 'react';

import { LOCALES, LOCALE_NAMES, LOCALE_SHORT, type Locale } from '@/lib/i18n/dictionaries';
import { cn } from '@/lib/utils';

/**
 * Troca o idioma do site.
 *
 * A escolha vai para um cookie e o servidor re-renderiza — não há tradução no
 * navegador. Isso é o que faz o conteúdo vindo do banco (as notícias) mudar
 * junto com os textos fixos: quem decide qual versão da matéria mostrar é o
 * servidor, que precisa saber o idioma antes de consultar.
 *
 * `router.refresh()` recarrega os componentes de servidor mantendo a posição
 * da página e o estado do que está aberto. Um `location.reload()` faria a
 * página piscar e voltar ao topo.
 */
export function LocaleSwitcher({
  current,
  label,
}: {
  current: Locale;
  label: string;
}) {
  const router = useRouter();
  const [open, setOpen] = useState(false);

  async function choose(locale: Locale) {
    setOpen(false);

    // Quem grava o cookie é o servidor (`/api/locale`), que valida o valor e
    // define os atributos num lugar só. Ver a nota naquela rota.
    await fetch('/api/locale', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ locale }),
    }).catch(() => {
      // Falha de rede: o menu já fechou e a página segue no idioma atual.
    });

    router.refresh();
  }

  return (
    <div className="relative">
      <button
        type="button"
        onClick={() => setOpen((value) => !value)}
        className="glass-button flex h-9 items-center gap-1.5 rounded-sm px-2.5 text-xs font-extrabold tracking-widest text-muted uppercase transition-colors hover:text-fg"
        aria-label={label}
        aria-expanded={open}
        aria-haspopup="menu"
      >
        <Globe className="size-4" />
        {LOCALE_SHORT[current]}
      </button>

      {open ? (
        <>
          {/* Camada invisível que fecha o menu no clique fora. Mais confiável
              que ouvir cliques no documento, e some junto com o menu. */}
          <button
            type="button"
            className="fixed inset-0 z-40 cursor-default"
            onClick={() => setOpen(false)}
            aria-label={label}
            tabIndex={-1}
          />

          <div
            className="glass absolute right-0 z-50 mt-2 w-44 overflow-hidden rounded-xl py-1"
            role="menu"
          >
            {LOCALES.map((locale) => (
              <button
                key={locale}
                type="button"
                role="menuitem"
                onClick={() => void choose(locale)}
                className={cn(
                  'flex w-full items-center justify-between px-3 py-2 text-sm transition-colors hover:bg-fg/8',
                  locale === current ? 'font-bold text-accent' : 'text-muted hover:text-fg',
                )}
              >
                {LOCALE_NAMES[locale]}
                {locale === current ? <Check className="size-3.5" /> : null}
              </button>
            ))}
          </div>
        </>
      ) : null}
    </div>
  );
}
