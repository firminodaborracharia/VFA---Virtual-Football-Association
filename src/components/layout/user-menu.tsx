'use client';

import { ChevronDown, LogOut, ShieldCheck } from 'lucide-react';
import Link from 'next/link';
import { useEffect, useRef, useState } from 'react';

import type { HeaderUser } from '@/components/layout/site-header';
import { signOutAction } from '@/lib/actions/auth';
import { cn, initials } from '@/lib/utils';

export function UserMenu({ user }: { user: NonNullable<HeaderUser> }) {
  const [open, setOpen] = useState(false);
  const ref = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (!open) return;
    const onClick = (event: MouseEvent) => {
      if (ref.current && !ref.current.contains(event.target as Node)) setOpen(false);
    };
    const onKey = (event: KeyboardEvent) => {
      if (event.key === 'Escape') setOpen(false);
    };
    document.addEventListener('mousedown', onClick);
    document.addEventListener('keydown', onKey);
    return () => {
      document.removeEventListener('mousedown', onClick);
      document.removeEventListener('keydown', onKey);
    };
  }, [open]);

  const label = user.name ?? user.discordUsername ?? 'Torcedor';

  return (
    <div className="relative" ref={ref}>
      <button
        type="button"
        onClick={() => setOpen((value) => !value)}
        className="flex h-9 items-center gap-2 rounded-lg border border-line-strong bg-surface-2 pr-2 pl-1.5 transition-colors hover:border-accent/40"
        aria-haspopup="menu"
        aria-expanded={open}
      >
        {user.image ? (
          // eslint-disable-next-line @next/next/no-img-element
          <img src={user.image} alt="" className="size-6 rounded-full object-cover" />
        ) : (
          <span className="flex size-6 items-center justify-center rounded-full bg-accent/20 text-[0.65rem] font-bold text-accent">
            {initials(label)}
          </span>
        )}
        <span className="hidden max-w-28 truncate text-sm font-semibold text-fg sm:block">
          {label}
        </span>
        <ChevronDown
          className={cn('size-3.5 text-subtle transition-transform', open && 'rotate-180')}
        />
      </button>

      {/*
        Este menu está no cabeçalho, ou seja, em toda página do site — e era o
        último ponto puxando a biblioteca de animação para o pacote inicial.
        Uma abertura de menu suspenso é uma transição de opacidade e escala; o
        CSS faz isso sozinho.
      */}
      {open ? (
          <div
            className="animate-fade-in absolute right-0 z-50 mt-2 w-60 overflow-hidden rounded-xl border border-line bg-surface shadow-pop"
            role="menu"
          >
            <div className="border-b border-line px-4 py-3">
              <p className="truncate text-sm font-bold text-fg">{label}</p>
              {user.discordUsername ? (
                <p className="truncate text-xs text-muted">@{user.discordUsername}</p>
              ) : null}
              <p className="mt-2 inline-flex items-center gap-1.5 rounded-full border border-line bg-surface-2 px-2 py-0.5 text-[0.65rem] font-bold tracking-wide uppercase">
                {user.role === 'ADMIN' ? (
                  <>
                    <ShieldCheck className="size-3 text-accent-warm" />
                    <span className="text-accent-warm">Administrador</span>
                  </>
                ) : (
                  <span className="text-subtle">Torcedor</span>
                )}
              </p>
            </div>

            {user.role === 'ADMIN' ? (
              <Link
                href="/admin"
                className="flex items-center gap-2.5 px-4 py-2.5 text-sm font-semibold text-muted transition-colors hover:bg-surface-2 hover:text-fg"
                role="menuitem"
              >
                <ShieldCheck className="size-4" />
                Painel administrativo
              </Link>
            ) : null}

            <form action={signOutAction}>
              <button
                type="submit"
                className="flex w-full items-center gap-2.5 px-4 py-2.5 text-left text-sm font-semibold text-muted transition-colors hover:bg-loss/10 hover:text-loss"
                role="menuitem"
              >
                <LogOut className="size-4" />
                Sair
              </button>
            </form>
          </div>
        ) : null}
    </div>
  );
}
