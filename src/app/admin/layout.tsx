import { ArrowLeft } from 'lucide-react';
import type { Metadata } from 'next';
import Link from 'next/link';
import type { ReactNode } from 'react';

import { AdminNav } from '@/components/admin/admin-nav';
import { requireAdmin } from '@/lib/rbac';

export const dynamic = 'force-dynamic';

export const metadata: Metadata = {
  title: { default: 'Administração', template: '%s · Admin VFA' },
  robots: { index: false, follow: false },
};

/**
 * Proteção da área administrativa — item 27 do escopo.
 *
 * A checagem acontece aqui, no servidor, e vale para TODAS as rotas abaixo de
 * /admin. As rotas de API repetem a checagem por conta própria: esconder a
 * interface nunca é a única barreira.
 */
export default async function AdminLayout({ children }: { children: ReactNode }) {
  const session = await requireAdmin();

  return (
    <div className="container-vfa py-8">
      <div className="mb-6 flex flex-wrap items-center justify-between gap-3">
        <div>
          <Link
            href="/"
            className="inline-flex items-center gap-1.5 text-sm font-semibold text-muted transition-colors hover:text-accent"
          >
            <ArrowLeft className="size-4" />
            Voltar ao site
          </Link>
          <h1 className="mt-1.5 text-2xl font-black tracking-tight">Painel administrativo</h1>
        </div>

        <p className="text-sm text-subtle">
          Logado como <span className="font-semibold text-fg">{session.user.name ?? 'admin'}</span>
        </p>
      </div>

      <div className="flex flex-col gap-6 lg:flex-row">
        <AdminNav />
        <div className="min-w-0 flex-1">{children}</div>
      </div>
    </div>
  );
}
