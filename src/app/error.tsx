'use client';

import { AlertTriangle } from 'lucide-react';
import { useEffect } from 'react';

import { Button, ButtonLink } from '@/components/ui/button';

/**
 * Fronteira de erro global — item 36 do escopo.
 * Mostra mensagem amigável, nunca o stack trace, e oferece uma ação de saída.
 */
export default function GlobalError({
  error,
  reset,
}: {
  error: Error & { digest?: string };
  reset: () => void;
}) {
  useEffect(() => {
    console.error('[VFA] Erro na página:', error);
  }, [error]);

  return (
    <div className="container-vfa flex min-h-[65vh] items-center justify-center py-14">
      <div className="max-w-md text-center">
        <div className="mx-auto flex size-16 items-center justify-center rounded-2xl bg-loss/10 text-loss">
          <AlertTriangle className="size-8" />
        </div>
        <h1 className="mt-6 text-2xl font-black tracking-tight">Algo deu errado por aqui</h1>
        <p className="mt-3 text-muted">
          Não foi possível carregar este conteúdo. Isso costuma acontecer quando o banco de dados
          está indisponível ou a conexão caiu no meio do caminho.
        </p>
        {error.digest ? (
          <p className="mt-3 font-mono text-xs text-subtle">Código do erro: {error.digest}</p>
        ) : null}
        <div className="mt-7 flex justify-center gap-3">
          <Button onClick={reset}>Tentar novamente</Button>
          <ButtonLink href="/" variant="outline">
            Voltar ao início
          </ButtonLink>
        </div>
      </div>
    </div>
  );
}
