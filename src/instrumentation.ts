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
  printFix(error);
  console.error('');
};

/**
 * Transforma o código de erro do PostgreSQL em instrução.
 *
 * "column news.title_en does not exist" é uma frase precisa e inútil para quem
 * só quer o site de pé: ela descreve o sintoma, não o que fazer. Quase sempre
 * a resposta é uma linha de comando, e é ela que precisa aparecer — abaixo de
 * uma parede de SQL, ninguém vai deduzir sozinho.
 */
function printFix(error: unknown): void {
  const code = findPgCode(error);
  if (!code) return;

  const fixes: Record<string, string[]> = {
    // Coluna inexistente: o código pede uma coluna que a migration cria.
    '42703': [
      'O código espera uma coluna que ainda não existe neste banco.',
      'As migrations não foram aplicadas depois da última atualização. Rode:',
      '',
      '    npm run db:migrate',
      '',
      'Depois reinicie o servidor (Ctrl+C e npm run dev).',
    ],
    // Tabela inexistente: banco novo, nada aplicado.
    '42P01': [
      'A tabela não existe neste banco. Rode:',
      '',
      '    npm run db:migrate',
      '    npm run db:seed     (opcional, dados de demonstração)',
    ],
    '28P01': [
      'Usuário ou senha do banco incorretos. Confira a DATABASE_URL no .env.local.',
      'Rode "npm run db:doctor" para o diagnóstico completo.',
    ],
    '3D000': ['O banco indicado na DATABASE_URL não existe. Confira o nome depois da última barra.'],
    '23505': ['Já existe um registro com este valor único (slug, e-mail ou código repetido).'],
    '23503': ['O registro referenciado não existe, ou algo ainda depende do que se tentou apagar.'],
  };

  const lines = fixes[code];
  if (!lines) return;

  console.error(`\n  ─── Como resolver (erro ${code}) ───`);
  for (const line of lines) console.error(`  ${line}`);
}

/** Percorre a cadeia de causas atrás do código de erro do PostgreSQL. */
function findPgCode(error: unknown, depth = 0): string | null {
  if (depth > 6 || !(error instanceof Error)) return null;

  const code = (error as Error & { code?: string }).code;
  // Códigos do PostgreSQL têm 5 caracteres; ENOTFOUND e afins são de rede.
  if (typeof code === 'string' && code.length === 5) return code;

  return findPgCode(error.cause, depth + 1);
}

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
