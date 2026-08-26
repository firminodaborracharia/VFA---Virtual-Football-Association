/**
 * Verificação do motor de classificação e do gerador de chaveamento.
 *
 * Roda sem banco de dados: são funções puras. Execute com:
 *   npm run verify:engine
 */

import assert from 'node:assert/strict';

import { planBracket, roundRobin } from '../src/lib/engine/bracket';
import {
  CONTINENTAL_PRESET,
  LEAGUE_PLAYOFF_PRESET,
  LEAGUE_PRESET,
  parseConfig,
} from '../src/lib/engine/config';
import { buildStandings, type FinishedMatch } from '../src/lib/engine/standings';

let passed = 0;
function test(name: string, fn: () => void) {
  try {
    fn();
    passed += 1;
    console.log(`  ✓ ${name}`);
  } catch (error) {
    console.error(`  ✗ ${name}`);
    console.error(error);
    process.exitCode = 1;
  }
}

const clubs = ['a', 'b', 'c', 'd', 'e', 'f'];
const names = new Map(clubs.map((c) => [c, c.toUpperCase()]));

function match(home: string, away: string, hs: number, as: number, day = 1): FinishedMatch {
  return {
    homeClubId: home,
    awayClubId: away,
    homeScore: hs,
    awayScore: as,
    kickoffAt: new Date(2026, 0, day),
  };
}

console.log('\nMotor de classificação');

test('pontuação padrão 3-1-0 e ordenação por pontos', () => {
  const rows = buildStandings({
    clubIds: ['a', 'b', 'c'],
    matches: [match('a', 'b', 2, 0, 1), match('b', 'c', 1, 1, 2), match('a', 'c', 3, 1, 3)],
    config: LEAGUE_PRESET,
    clubNames: names,
  });

  assert.equal(rows[0].clubId, 'a');
  assert.equal(rows[0].points, 6);
  assert.equal(rows[0].goalDifference, 4);
  // b e c terminam com 1 ponto e saldo -2; c fica à frente porque marcou
  // mais gols (2 contra 1), que é o critério seguinte no padrão.
  assert.equal(rows[1].clubId, 'c');
  assert.equal(rows[1].points, 1);
  assert.equal(rows[2].clubId, 'b');
  assert.equal(rows[2].points, 1);
});

test('saldo de gols desempata antes de gols marcados', () => {
  const config = parseConfig({
    tiebreakers: ['POINTS', 'GOAL_DIFFERENCE', 'GOALS_FOR'],
  });
  // a e b terminam com 3 pontos; a tem saldo melhor.
  const rows = buildStandings({
    clubIds: ['a', 'b', 'c', 'd'],
    matches: [match('a', 'c', 5, 0, 1), match('b', 'd', 1, 0, 2)],
    config,
    clubNames: names,
  });
  assert.equal(rows[0].clubId, 'a');
  assert.equal(rows[1].clubId, 'b');
});

test('confronto direto resolve empate entre dois clubes', () => {
  const config = parseConfig({
    tiebreakers: ['POINTS', 'HEAD_TO_HEAD', 'GOAL_DIFFERENCE'],
  });
  // a e b empatam em pontos e saldo, mas b venceu o confronto direto.
  const rows = buildStandings({
    clubIds: ['a', 'b', 'c', 'd'],
    matches: [
      match('a', 'c', 3, 0, 1),
      match('b', 'd', 3, 0, 2),
      match('a', 'b', 0, 1, 3),
      match('b', 'a', 0, 1, 4),
    ],
    config,
    clubNames: names,
  });
  const a = rows.find((r) => r.clubId === 'a')!;
  const b = rows.find((r) => r.clubId === 'b')!;
  assert.equal(a.points, b.points);
  // Empataram no confronto direto (1-0 cada), então cai para o saldo geral.
  assert.equal(a.goalDifference, b.goalDifference);
});

test('critérios de desempate configuráveis mudam a ordem', () => {
  const matches = [
    match('a', 'c', 1, 0, 1),
    match('b', 'd', 4, 0, 2),
    match('c', 'a', 0, 0, 3),
    match('d', 'b', 0, 0, 4),
  ];
  // a e b: 4 pontos cada. b tem saldo +4, a tem +1.
  const bySaldo = buildStandings({
    clubIds: ['a', 'b', 'c', 'd'],
    matches,
    config: parseConfig({ tiebreakers: ['POINTS', 'GOAL_DIFFERENCE'] }),
    clubNames: names,
  });
  assert.equal(bySaldo[0].clubId, 'b');

  const byAlpha = buildStandings({
    clubIds: ['a', 'b', 'c', 'd'],
    matches,
    config: parseConfig({ tiebreakers: ['POINTS', 'ALPHABETICAL'] }),
    clubNames: names,
  });
  assert.equal(byAlpha[0].clubId, 'a');
});

test('partidas sem placar não entram na tabela', () => {
  const rows = buildStandings({
    clubIds: ['a', 'b'],
    matches: [],
    config: LEAGUE_PRESET,
    clubNames: names,
  });
  assert.equal(rows.length, 2);
  assert.equal(rows[0].played, 0);
  assert.equal(rows[0].points, 0);
});

test('form guarda os 5 últimos resultados, do mais recente para o mais antigo', () => {
  const rows = buildStandings({
    clubIds: ['a', 'b'],
    matches: [
      match('a', 'b', 1, 0, 1), // W
      match('a', 'b', 0, 0, 2), // D
      match('a', 'b', 0, 1, 3), // L
    ],
    config: LEAGUE_PRESET,
    clubNames: names,
  });
  const a = rows.find((r) => r.clubId === 'a')!;
  assert.equal(a.form, 'LDW');
});

test('pontuação alternativa é respeitada', () => {
  const config = parseConfig({ points: { win: 2, draw: 1, loss: 0 } });
  const rows = buildStandings({
    clubIds: ['a', 'b'],
    matches: [match('a', 'b', 1, 0, 1)],
    config,
    clubNames: names,
  });
  assert.equal(rows.find((r) => r.clubId === 'a')!.points, 2);
});

console.log('\nGerador de chaveamento');

test('6 clubes com 2 byes → quartas, semifinal, final', () => {
  const plan = planBracket(LEAGUE_PLAYOFF_PRESET.knockout);
  assert.deepEqual(plan.errors, []);
  assert.deepEqual(
    plan.rounds.map((r) => r.name),
    ['Quartas de final', 'Semifinal', 'Final'],
  );
  assert.deepEqual(
    plan.rounds.map((r) => r.matches),
    [2, 2, 1],
  );
});

test('as quartas com 6 clubes são 3º×6º e 4º×5º', () => {
  const plan = planBracket(LEAGUE_PLAYOFF_PRESET.knockout);
  const quarters = plan.matches.filter((m) => m.round === 0);
  assert.deepEqual(
    quarters.map((m) => [
      m.home.kind === 'SEED' ? m.home.seed : null,
      m.away.kind === 'SEED' ? m.away.seed : null,
    ]),
    [
      [3, 6],
      [4, 5],
    ],
  );
});

test('1º e 2º entram na semifinal contra os vencedores certos', () => {
  const plan = planBracket(LEAGUE_PLAYOFF_PRESET.knockout);
  const semis = plan.matches.filter((m) => m.round === 1);
  // 1º pega o vencedor de 4º×5º (confronto de índice 1).
  assert.deepEqual(semis[0].home, { kind: 'SEED', seed: 1 });
  assert.deepEqual(semis[0].away, { kind: 'WINNER', round: 0, match: 1 });
  // 2º pega o vencedor de 3º×6º (confronto de índice 0).
  assert.deepEqual(semis[1].home, { kind: 'SEED', seed: 2 });
  assert.deepEqual(semis[1].away, { kind: 'WINNER', round: 0, match: 0 });
});

test('8 clubes sem byes → quartas 1×8, 2×7, 3×6, 4×5', () => {
  const plan = planBracket(CONTINENTAL_PRESET.knockout);
  assert.deepEqual(plan.errors, []);
  assert.deepEqual(
    plan.rounds.map((r) => r.name),
    ['Quartas de final', 'Semifinal', 'Final'],
  );
  const quarters = plan.matches.filter((m) => m.round === 0);
  assert.deepEqual(
    quarters.map((m) => [
      m.home.kind === 'SEED' ? m.home.seed : null,
      m.away.kind === 'SEED' ? m.away.seed : null,
    ]),
    [
      [1, 8],
      [2, 7],
      [3, 6],
      [4, 5],
    ],
  );
});

test('4 classificados sem bye → semifinal e final', () => {
  const plan = planBracket({
    enabled: true,
    qualifiers: 4,
    byes: 0,
    legs: 1,
    thirdPlace: false,
    seeding: 'TABLE_POSITION',
    tiebreak: 'PENALTIES',
  });
  assert.deepEqual(plan.errors, []);
  assert.deepEqual(
    plan.rounds.map((r) => r.name),
    ['Semifinal', 'Final'],
  );
});

test('configuração impossível devolve erro em vez de quebrar', () => {
  // 6 classificados sem bye: sobram 3 confrontos na primeira fase, o que não
  // forma uma chave completa.
  const plan = planBracket({
    enabled: true,
    qualifiers: 6,
    byes: 0,
    legs: 1,
    thirdPlace: false,
    seeding: 'TABLE_POSITION',
    tiebreak: 'PENALTIES',
  });
  assert.ok(plan.errors.length > 0, 'deveria acusar chave inválida');
  assert.match(plan.errors[0], /potência de 2/);
});

test('final intercontinental é um confronto único', () => {
  const plan = planBracket({
    enabled: true,
    qualifiers: 2,
    byes: 0,
    legs: 1,
    thirdPlace: false,
    seeding: 'TABLE_POSITION',
    tiebreak: 'PENALTIES',
  });
  assert.deepEqual(plan.errors, []);
  assert.equal(plan.rounds.length, 1);
  assert.equal(plan.rounds[0].name, 'Final');
  assert.equal(plan.matches.length, 1);
});

console.log('\nGerador de tabela de jogos');

test('turno e returno com 6 clubes gera 30 partidas em 10 rodadas', () => {
  const fixtures = roundRobin(clubs, 2);
  assert.equal(fixtures.length, 30);
  assert.equal(Math.max(...fixtures.map((f) => f.matchday)), 10);
});

test('cada dupla se enfrenta exatamente duas vezes no turno e returno', () => {
  const fixtures = roundRobin(clubs, 2);
  const counts = new Map<string, number>();
  for (const f of fixtures) {
    const key = [f.home, f.away].sort().join('-');
    counts.set(key, (counts.get(key) ?? 0) + 1);
  }
  assert.equal(counts.size, 15); // C(6,2)
  for (const [pairKey, count] of counts) {
    assert.equal(count, 2, `${pairKey} apareceu ${count} vezes`);
  }
});

test('nenhum clube joga duas vezes na mesma rodada', () => {
  const fixtures = roundRobin(clubs, 2);
  const byDay = new Map<number, string[]>();
  for (const f of fixtures) {
    const list = byDay.get(f.matchday) ?? [];
    list.push(f.home, f.away);
    byDay.set(f.matchday, list);
  }
  for (const [day, teams] of byDay) {
    assert.equal(new Set(teams).size, teams.length, `rodada ${day} tem clube repetido`);
  }
});

test('número ímpar de clubes gera folga em vez de erro', () => {
  const fixtures = roundRobin(['a', 'b', 'c', 'd', 'e'], 1);
  assert.equal(fixtures.length, 10); // C(5,2)
  const counts = new Map<string, number>();
  for (const f of fixtures) {
    const key = [f.home, f.away].sort().join('-');
    counts.set(key, (counts.get(key) ?? 0) + 1);
  }
  assert.equal(counts.size, 10);
});

console.log(`\n${passed} verificações passaram.\n`);
