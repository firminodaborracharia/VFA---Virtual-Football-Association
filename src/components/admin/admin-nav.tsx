'use client';

import Link from 'next/link';
import { usePathname } from 'next/navigation';

import { ADMIN_NAV } from '@/lib/nav';
import { cn } from '@/lib/utils';

export function AdminNav() {
  const pathname = usePathname();

  return (
    <nav className="table-scroll -mx-1 shrink-0 lg:w-56" aria-label="Menu do painel">
      <ul className="flex gap-1 px-1 lg:flex-col lg:gap-0.5">
        {ADMIN_NAV.map((item) => {
          const Icon = item.icon;
          const active =
            item.href === '/admin' ? pathname === '/admin' : pathname.startsWith(item.href);

          return (
            <li key={item.href} className="shrink-0">
              <Link
                href={item.href}
                className={cn(
                  'flex items-center gap-2.5 rounded-xl px-3 py-2.5 text-sm font-semibold whitespace-nowrap transition-colors',
                  active
                    ? 'bg-accent/10 text-accent'
                    : 'text-muted hover:bg-surface-2 hover:text-fg',
                )}
              >
                <Icon className="size-4" />
                {item.label}
              </Link>
            </li>
          );
        })}
      </ul>
    </nav>
  );
}
