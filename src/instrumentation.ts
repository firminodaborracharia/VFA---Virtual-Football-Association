import type { Instrumentation } from 'next';

/**
 * Erros de servidor legíveis no terminal.
 *
 * O Drizzle embrulha falhas de banco numa mensagem `Failed query: select …` e
 * guarda o erro real do PostgreSQL em `error.cause`. Sem desembrulhar, o que
 * aparece na tela é a consulta — e não o motivo, que pode ser "tabela não
 * existe", "senha incorreta" ou "rede inalcançável".
 *
 * Este hook percorre a cadeia de causas e imprime o motivo de verdade, com o
 * código do erro do PostgreSQL, sempre que algo falhar no servidor.
 */
export const onRequestError: Instrumentation.onRequestError = (error, request) => {
  console.error(`\n[VFA] Erro em ${request.method} ${request.path}`);
  printCauseChain(error);
  console.error('');
};

function printCauseChain(error: unknown, depth = 0): void {
  const indent = '  '.repeat(depth + 1);

  if (!(error instanceof Error)) {
    console.error(`${indent}${String(error)}`);
    return;
  }

  console.error(`${indent}${error.name}: ${error.message}`);

  const extras = error as Error & {
    code?: string;
    severity?: string;
    detail?: string;
    hint?: string;
    address?: string;
    port?: number;
  };

  for (const field of ['code', 'severity', 'detail', 'hint', 'address', 'port'] as const) {
    if (extras[field] !== undefined) console.error(`${indent}  ${field}: ${extras[field]}`);
  }

  if (depth === 0 && error.stack) {
    // Só as primeiras linhas: o resto é ruído do framework.
    const frames = error.stack.split('\n').slice(1, 4).join('\n');
    if (frames.trim()) console.error(frames);
  }

  if (error.cause) {
    console.error(`${indent}  ↳ causa:`);
    printCauseChain(error.cause, depth + 1);
  } else if (depth === 0) {
    console.error(`${indent}  (sem causa aninhada)`);
  }
}
