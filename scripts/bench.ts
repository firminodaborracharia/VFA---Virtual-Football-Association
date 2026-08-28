/**
 * Cronômetro do banco — responde "o site está lento por causa do banco?".
 *
 * Quando uma página demora e nada aparece no terminal, existem dois culpados
 * possíveis e eles pedem soluções opostas:
 *
 *   1. O BANCO está distante ou lento. Cada consulta custa uma viagem de rede,
 *      e a home faz dezenas delas.
 *   2. A COMPILAÇÃO do Next está lenta. Acontece no Windows quando o projeto
 *      fica numa pasta vigiada pelo antivírus (Downloads, Área de Trabalho,
 *      OneDrive), e não tem nada a ver com banco.
 *
 * Este script mede só o item 1, com as consultas de verdade da home. Se o
 * total sair rápido aqui e a página continuar demorando no navegador, o
 * problema é o item 2 — e o relatório final diz isso na cara.
 *
 *   npm run bench
 */

import './load-env';

import postgres from 'postgres';

type Medida = { nome: string; ms: number; linhas: number };

const medidas: Medida[] = [];

async function medir<T>(nome: string, executar: () => Promise<T[]>): Promise<T[]> {
  const início = performance.now();
  const linhas = await executar();
  const ms = performance.now() - início;
  medidas.push({ nome, ms, linhas: linhas.length });
  return linhas;
}

function formatar(ms: number): string {
  return `${ms.toFixed(0).padStart(6)}ms`;
}

function barra(ms: number, teto: number): string {
  const largura = Math.max(1, Math.round((ms / teto) * 32));
  return '█'.repeat(Math.min(32, largura));
}

async function main() {
  console.log('\n═══ Cronômetro do banco — VFA ═══\n');

  const url = process.env.DATABASE_URL;
  if (!url) {
    console.log('✗ DATABASE_URL não encontrada. Rode "npm run check:env" primeiro.\n');
    process.exit(1);
  }

  try {
    const parsed = new URL(url);
    console.log(`Banco: ${parsed.hostname}:${parsed.port || 5432}\n`);
  } catch {
    console.log('✗ DATABASE_URL não é uma URL válida.\n');
    process.exit(1);
  }

  const sql = postgres(url, { max: 8, prepare: false, connect_timeout: 8, idle_timeout: 5 });

  // ── Latência pura: quanto custa uma ida e volta sem trabalho nenhum ──
  console.log('─── Latência de rede ───\n');

  const pings: number[] = [];
  for (let i = 0; i < 5; i += 1) {
    const início = performance.now();
    try {
      await sql`select 1 as ok`;
    } catch (error) {
      console.log('✗ Não foi possível consultar o banco.');
      console.log(`  ${error instanceof Error ? error.message : String(error)}`);
      console.log('\n  Rode "npm run db:doctor" para o diagnóstico completo.\n');
      await sql.end({ timeout: 3 }).catch(() => {});
      process.exit(1);
    }
    pings.push(performance.now() - início);
  }

  // O primeiro inclui o handshake da conexão; os outros são a latência real.
  const [handshake, ...restantes] = pings;
  const latência = restantes.reduce((soma, valor) => soma + valor, 0) / restantes.length;

  console.log(`  primeira conexão : ${formatar(handshake)}  (inclui handshake TLS)`);
  console.log(`  ida e volta média: ${formatar(latência)}`);

  if (latência > 150) {
    console.log('\n  ⚠ Latência alta. Cada consulta paga esse pedágio, e uma página faz dezenas.');
    console.log('    Se o banco está numa região distante, escolher uma região mais perto');
    console.log('    do Brasil (sa-east-1) resolve mais que qualquer ajuste de código.');
  }

  // ── As consultas reais da home, na mesma ordem ──
  console.log('\n─── Consultas da página inicial ───\n');

  const totalInício = performance.now();

  const [temporada] = await medir(
    'temporada ativa',
    () => sql`select id, year, name from seasons where is_active = true limit 1`,
  );

  if (!temporada) {
    console.log('  ⚠ Nenhuma temporada no banco. Rode "npm run db:seed".\n');
    await sql.end({ timeout: 3 });
    return;
  }

  const temporadaId = (temporada as { id: string }).id;

  await medir('configurações do site', () => sql`select key, value from app_settings`);

  await medir('ligas', () => sql`select id, name, slug from leagues order by sort_order`);

  await medir(
    'competições da temporada',
    () => sql`select id, name, type from competitions where season_id = ${temporadaId}`,
  );

  await medir(
    'próximas partidas',
    () => sql`
      select id, kickoff_at from matches
      where season_id = ${temporadaId} and status = 'SCHEDULED'
      order by kickoff_at asc limit 5
    `,
  );

  await medir(
    'últimos resultados',
    () => sql`
      select id, home_score, away_score from matches
      where season_id = ${temporadaId} and status = 'FINISHED'
      order by kickoff_at desc limit 6
    `,
  );

  await medir(
    'notícias publicadas',
    () => sql`
      select id, slug, title from news
      where status = 'PUBLISHED' order by published_at desc limit 4
    `,
  );

  await medir(
    'artilheiro',
    () => sql`
      select player_id, goals from player_season_stats
      where season_id = ${temporadaId} order by goals desc limit 1
    `,
  );

  await medir(
    'líder de assistências',
    () => sql`
      select player_id, assists from player_season_stats
      where season_id = ${temporadaId} order by assists desc limit 1
    `,
  );

  await medir(
    'classificação da liga',
    () => sql`
      select club_id, points, played from club_season_stats
      where season_id = ${temporadaId} order by points desc limit 20
    `,
  );

  const totalMs = performance.now() - totalInício;

  // ── Relatório ──
  const teto = Math.max(...medidas.map((m) => m.ms));

  for (const medida of medidas) {
    const nome = medida.nome.padEnd(26);
    console.log(`  ${nome} ${formatar(medida.ms)}  ${barra(medida.ms, teto)}`);
  }

  console.log(`\n  ${'TOTAL'.padEnd(26)} ${formatar(totalMs)}`);

  // ── Veredito ──
  console.log('\n─── Veredito ───\n');

  if (totalMs < 800) {
    console.log('✓ O banco NÃO é o gargalo. Estas são as mesmas consultas que a home faz,');
    console.log(`  e todas juntas levaram ${totalMs.toFixed(0)}ms.\n`);
    console.log('  Se a página ainda demora no navegador, o tempo está na compilação do');
    console.log('  Next, não no banco. O que costuma resolver, em ordem de impacto:\n');
    console.log('   1. Tirar o projeto de uma pasta vigiada pelo antivírus.');
    console.log('      Downloads, Área de Trabalho e OneDrive são varridas a cada arquivo');
    console.log('      lido — e o Next lê milhares. Mova para C:\\dev\\vfa e rode de lá.');
    console.log('   2. Adicionar a pasta do projeto e a pasta node_modules às exclusões');
    console.log('      do Windows Defender (Segurança do Windows → Proteção contra vírus');
    console.log('      → Gerenciar configurações → Exclusões).');
    console.log('   3. Apagar a pasta .next e subir de novo: a primeira compilação de cada');
    console.log('      página é sempre a mais lenta, as seguintes usam o cache.');
    console.log('   4. Testar com "npm run build && npm start". Se ficar rápido assim, está');
    console.log('      confirmado: era compilação, não banco nem código.\n');
  } else if (totalMs < 3000) {
    console.log(`⚠ O banco responde, mas devagar: ${totalMs.toFixed(0)}ms só de consultas.`);
    console.log(`  Com ${latência.toFixed(0)}ms de ida e volta, quase tudo é distância de rede.\n`);
    console.log('  A página vai carregar, mas com atraso perceptível. Vale conferir se o');
    console.log('  banco está numa região próxima e se a string de conexão é a do pooler.\n');
  } else {
    console.log(`✗ O banco é o gargalo: ${totalMs.toFixed(0)}ms só nas consultas da home.\n`);
    const maisLenta = medidas.reduce((pior, atual) => (atual.ms > pior.ms ? atual : pior));
    console.log(`  A consulta mais cara foi "${maisLenta.nome}" (${maisLenta.ms.toFixed(0)}ms).`);
    console.log('  Se ela for muito mais lenta que as outras, provavelmente falta um índice');
    console.log('  ou a tabela cresceu além do esperado. Se TODAS estiverem lentas, é rede:');
    console.log('  confira a região do banco e se a conexão é a do pooler (porta 6543).\n');
  }

  await sql.end({ timeout: 3 });
}

void main();
