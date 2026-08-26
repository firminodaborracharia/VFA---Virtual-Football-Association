import { SearchX } from 'lucide-react';

import { ButtonLink } from '@/components/ui/button';

export default function NotFound() {
  return (
    <div className="container-vfa flex min-h-[65vh] items-center justify-center py-14">
      <div className="max-w-md text-center">
        <div className="mx-auto flex size-16 items-center justify-center rounded-2xl bg-surface-2 text-subtle">
          <SearchX className="size-8" />
        </div>
        <p className="mt-6 font-mono text-5xl font-black text-line-strong">404</p>
        <h1 className="mt-2 text-2xl font-black tracking-tight">Página não encontrada</h1>
        <p className="mt-3 text-muted">
          O endereço que você tentou abrir não existe, ou o conteúdo foi removido.
        </p>
        <div className="mt-7 flex justify-center gap-3">
          <ButtonLink href="/">Voltar ao início</ButtonLink>
          <ButtonLink href="/jogadores" variant="outline">
            Ver jogadores
          </ButtonLink>
        </div>
      </div>
    </div>
  );
}
