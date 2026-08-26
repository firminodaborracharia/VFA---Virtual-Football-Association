import { ShieldAlert } from 'lucide-react';
import type { Metadata } from 'next';

import { ButtonLink } from '@/components/ui/button';

export const metadata: Metadata = {
  title: 'Sem permissão',
};

export default function ForbiddenPage() {
  return (
    <div className="container-vfa flex min-h-[65vh] items-center justify-center py-14">
      <div className="max-w-md text-center">
        <div className="mx-auto flex size-16 items-center justify-center rounded-2xl bg-loss/10 text-loss">
          <ShieldAlert className="size-8" />
        </div>
        <h1 className="mt-6 text-3xl font-black tracking-tight">Área restrita</h1>
        <p className="mt-3 text-muted">
          Esta parte do site é exclusiva para administradores da VFA. Se você deveria ter acesso,
          peça a um administrador para promover a sua conta em Administração → Usuários.
        </p>
        <div className="mt-7 flex justify-center gap-3">
          <ButtonLink href="/">Voltar ao início</ButtonLink>
          <ButtonLink href="/partidas" variant="outline">
            Ver partidas
          </ButtonLink>
        </div>
      </div>
    </div>
  );
}
