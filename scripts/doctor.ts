/**
 * Diagnóstico da conexão com o banco.
 *
 * O `Failed query` que o Drizzle mostra esconde o erro real do PostgreSQL
 * dentro de `error.cause`. Este script vai atrás dessa causa e imprime tudo:
 * como a URL foi interpretada, se o servidor responde, se as tabelas existem e
 * se há dados.
 *
 *   npx tsx scripts/doctor.ts
 */

import './load-env';

import postgres from 'postgres';

const TABELAS_ESPERADAS = [
  'users',
  'sessions',
  'nations',
  'seasons',
  'leagues',
  'clubs',
  'players',
  'competitions',
  'matches',
  'club_season_stats',
  'player_season_stats',
  'news',
];

/** Percorre a cadeia de `cause` até o erro de baixo nível. */
function explicar(error: unknown, profundidade = 0): void {
  const recuo = '  '.repeat(profundidade + 1);

  if (!(error instanceof Error)) {
    console.log(`${recuo}${String(error)}`);
    return;
  }

  console.log(`${recuo}${error.name}: ${error.message}`);

  const extras = error as Error & {
    code?: string;
    severity?: string;
    detail?: string;
    hint?: string;
    routine?: string;
    address?: string;
    port?: number;
    errno?: number;
  };

  for (const campo of ['code', 'severity', 'detail', 'hint', 'routine', 'address', 'port'] as const) {
    if (extras[campo] !== undefined) {
      console.log(`${recuo}  ${campo}: ${extras[campo]}`);
    }
  }

  if (error.cause) {
    console.log(`${recuo}  causa:`);
    explicar(error.cause, profundidade + 1);
  }
}

function interpretar(error: unknown): string[] {
  const código = (error as { code?: string })?.code;
  const mensagem = error instanceof Error ? error.message.toLowerCase() : String(error).toLowerCase();

  if (código === 'ENOTFOUND' || mensagem.includes('enotfound')) {
    return [
      'O host da DATABASE_URL não existe ou não resolve.',
      'Confira se você copiou a string inteira, sem quebra de linha.',
    ];
  }

  if (código === 'ENETUNREACH' || mensagem.includes('enetunreach')) {
    return [
      'A rede não alcança o servidor — quase sempre é IPv6.',
      'A conexão DIRETA do Supabase (db.xxxx.supabase.co:5432) só aceita IPv6,',
      'e a maioria das operadoras domésticas não fornece IPv6.',
      'Use a string do POOLER, que é IPv4:',
      '  Supabase → Project Settings → Database → Connection string → escolha "Transaction pooler"',
      '  O host fica parecido com aws-0-sa-east-1.pooler.supabase.com e a porta é 6543.',
    ];
  }

  if (código === 'ECONNREFUSED' || mensagem.includes('econnrefused')) {
    return [
      'O servidor recusou a conexão: host ou porta errados, ou o banco não está no ar.',
      'Se for Postgres local, confirme que o serviço está rodando.',
    ];
  }

  if (código === 'ETIMEDOUT' || mensagem.includes('timeout')) {
    return [
      'A conexão expirou. Costuma ser firewall, VPN ou rede corporativa bloqueando a porta.',
      'Teste em outra rede (o 4G do celular serve) para confirmar.',
    ];
  }

  if (mensagem.includes('ssl') || mensagem.includes('no encryption')) {
    return [
      'O servidor exige SSL e a conexão foi aberta sem.',
      'Acrescente ?sslmode=require ao final da DATABASE_URL.',
    ];
  }

  if (código === '28P01' || mensagem.includes('password authentication failed')) {
    return [
      'Usuário ou senha incorretos.',
      'Se a senha tiver caracteres especiais (@ : / ? #), ela precisa vir codificada na URL.',
      'No Supabase, o caminho seguro é usar "Reset database password" e gerar uma sem símbolos.',
    ];
  }

  if (código === '3D000' || mensagem.includes('does not exist')) {
    return ['O banco indicado na URL não existe. Confira o nome depois da última barra.'];
  }

  if (código === '42P01') {
    return [
      'As tabelas ainda não foram criadas neste banco.',
      'Rode: npm run db:migrate',
    ];
  }

  return [];
}

async function main() {
  console.log('\n═══ Diagnóstico do banco — VFA ═══\n');

  const url = process.env.DATABASE_URL;

  if (!url) {
    console.log('✗ DATABASE_URL não foi encontrada.\n');
    console.log('  O arquivo precisa se chamar exatamente .env.local e ficar na raiz do projeto');
    console.log('  (ao lado do package.json). No Windows, cuidado com o Bloco de Notas salvando');
    console.log('  como ".env.local.txt" — ative a exibição de extensões para conferir.\n');
    process.exit(1);
  }

  // ── Como a URL foi interpretada (sem revelar a senha) ──
  try {
    const parsed = new URL(url);
    console.log('DATABASE_URL interpretada assim:');
    console.log(`  protocolo : ${parsed.protocol.replace(':', '')}`);
    console.log(`  usuário   : ${parsed.username || '(vazio)'}`);
    console.log(`  senha     : ${parsed.password ? `definida (${parsed.password.length} caracteres)` : '(vazia)'}`);
    console.log(`  host      : ${parsed.hostname}`);
    console.log(`  porta     : ${parsed.port || '(padrão 5432)'}`);
    console.log(`  banco     : ${parsed.pathname.replace('/', '') || '(vazio)'}`);
    console.log(`  parâmetros: ${parsed.search || '(nenhum)'}`);

    if (parsed.hostname.includes('supabase') && !parsed.hostname.includes('pooler')) {
      console.log('\n  ⚠ Esta é a conexão DIRETA do Supabase, que só aceita IPv6.');
      console.log('    Se a sua internet não tiver IPv6, troque pela string do Transaction pooler.');
    }
    if (parsed.password && /[@:/?#[\]]/.test(decodeURIComponent(parsed.password))) {
      console.log('\n  ⚠ A senha tem caracteres especiais. Confirme que estão codificados na URL.');
    }
  } catch {
    console.log('✗ A DATABASE_URL não é uma URL válida. Copie a string inteira, sem espaços nem aspas extras.');
    process.exit(1);
  }

  console.log('\n─── Testando a conexão ───\n');

  const sql = postgres(url, { max: 1, prepare: false, connect_timeout: 15, idle_timeout: 5 });

  try {
    const [info] = await sql<{ versao: string; banco: string; usuario: string }[]>`
      select version() as versao, current_database() as banco, current_user as usuario
    `;
    console.log('✓ Conectou.');
    console.log(`  banco   : ${info.banco}`);
    console.log(`  usuário : ${info.usuario}`);
    console.log(`  versão  : ${info.versao.split(',')[0]}`);
  } catch (error) {
    console.log('✗ Não foi possível conectar. Erro real:\n');
    explicar(error);

    const dicas = interpretar(error);
    if (dicas.length > 0) {
      console.log('\n  O que costuma resolver:');
      for (const dica of dicas) console.log(`    ${dica}`);
    }

    console.log('');
    await sql.end({ timeout: 3 }).catch(() => {});
    process.exit(1);
  }

  // ── Tabelas ──
  console.log('\n─── Verificando as tabelas ───\n');

  try {
    const existentes = await sql<{ table_name: string }[]>`
      select table_name from information_schema.tables where table_schema = 'public'
    `;
    const nomes = new Set(existentes.map((linha) => linha.table_name));
    const faltando = TABELAS_ESPERADAS.filter((tabela) => !nomes.has(tabela));

    console.log(`  encontradas: ${nomes.size} tabela(s) no schema public`);

    if (faltando.length > 0) {
      console.log(`\n✗ Faltam ${faltando.length} tabela(s): ${faltando.join(', ')}\n`);
      console.log('  As migrations não foram aplicadas neste banco. Rode:');
      console.log('    npm run db:migrate\n');
      await sql.end({ timeout: 3 });
      process.exit(1);
    }

    console.log('✓ Todas as tabelas esperadas existem.');
  } catch (error) {
    console.log('✗ Falha ao listar as tabelas:\n');
    explicar(error);
    await sql.end({ timeout: 3 }).catch(() => {});
    process.exit(1);
  }

  // ── Conteúdo ──
  console.log('\n─── Verificando o conteúdo ───\n');

  try {
    const [contagem] = await sql<
      { temporadas: number; ativas: number; clubes: number; jogadores: number; partidas: number }[]
    >`
      select
        (select count(*) from seasons)::int                        as temporadas,
        (select count(*) from seasons where is_active)::int        as ativas,
        (select count(*) from clubs)::int                          as clubes,
        (select count(*) from players)::int                        as jogadores,
        (select count(*) from matches)::int                        as partidas
    `;

    console.log(`  temporadas : ${contagem.temporadas} (${contagem.ativas} ativa)`);
    console.log(`  clubes     : ${contagem.clubes}`);
    console.log(`  jogadores  : ${contagem.jogadores}`);
    console.log(`  partidas   : ${contagem.partidas}`);

    if (contagem.temporadas === 0) {
      console.log('\n  ⚠ Banco vazio. O site sobe, mas sem nada para mostrar.');
      console.log('    Rode: npm run db:seed\n');
    } else {
      console.log('\n✓ Está tudo certo. O erro da home não vem do banco.');
      console.log('  Reinicie o servidor (Ctrl+C e npm run dev) e recarregue a página.\n');
    }
  } catch (error) {
    console.log('✗ Falha ao consultar os dados:\n');
    explicar(error);
    console.log('');
  }

  await sql.end({ timeout: 3 });
}

void main();
