/**
 * Dados de demonstração — item 33 do escopo.
 *
 * Cria uma temporada inteira e coerente: 4 ligas, 6 clubes cada, elencos,
 * calendário completo, resultados, tabelas calculadas, mata-mata das ligas,
 * Libertadores, Champions League, final Intercontinental e notícias.
 *
 * TUDO é marcado com `isDemo = true` e o site exibe um aviso enquanto esses
 * dados existirem. Para removê-los sem perder o que a VFA cadastrar de
 * verdade:  npm run db:reset
 *
 * Os resultados são gerados com uma semente fixa, então rodar o seed duas
 * vezes produz exatamente a mesma temporada — o que facilita comparar telas.
 *
 * A sincronização com o Roblox NÃO é executada aqui: os usernames são
 * fictícios e não existem na plataforma. Os jogadores ficam com o fallback de
 * iniciais no lugar do avatar, e o botão "Atualizar dados Roblox" fica
 * disponível para os jogadores reais.
 */

import './load-env';

import { eq, sql } from 'drizzle-orm';
import { drizzle } from 'drizzle-orm/postgres-js';
import postgres from 'postgres';

import { roundRobin } from '../src/lib/engine/bracket';
import {
  CONTINENTAL_PRESET,
  INTERCONTINENTAL_PRESET,
  LEAGUE_PLAYOFF_PRESET,
  LEAGUE_PRESET,
} from '../src/lib/engine/config';
import * as schema from '../src/db/schema';
import { slugify } from '../src/lib/utils';

const {
  appSettings,
  clubSeasonMemberships,
  clubs,
  competitionTeams,
  competitions,
  matchAppearances,
  matchEvents,
  matches,
  nations,
  news,
  newsCategories,
  players,
  qualificationZones,
  seasons,
  transfers,
} = schema;

/* ── Gerador pseudoaleatório determinístico ────────────────── */

let seedState = 20260824;
function random(): number {
  seedState ^= seedState << 13;
  seedState ^= seedState >>> 17;
  seedState ^= seedState << 5;
  return Math.abs(seedState % 100000) / 100000;
}
const pick = <T,>(items: T[]): T => items[Math.floor(random() * items.length)];
const between = (min: number, max: number) => min + Math.floor(random() * (max - min + 1));

/** Garante nomes de jogador distintos entre todos os clubes. */
const usedNames = new Set<string>();
function uniqueName(first: string): string {
  if (!usedNames.has(first)) {
    usedNames.add(first);
    return first;
  }
  for (const nickname of NICKNAMES) {
    const candidate = `${first} ${nickname}`;
    if (!usedNames.has(candidate)) {
      usedNames.add(candidate);
      return candidate;
    }
  }
  let counter = 2;
  while (usedNames.has(`${first} ${counter}`)) counter += 1;
  const fallback = `${first} ${counter}`;
  usedNames.add(fallback);
  return fallback;
}

/* ── Dados de referência ───────────────────────────────────── */

const NATIONS = [
  { code: 'BR', name: 'Brasil', flagEmoji: '🇧🇷' },
  { code: 'AR', name: 'Argentina', flagEmoji: '🇦🇷' },
  { code: 'EN', name: 'Inglaterra', flagEmoji: '🏴󠁧󠁢󠁥󠁮󠁧󠁿' },
  { code: 'ES', name: 'Espanha', flagEmoji: '🇪🇸' },
  { code: 'PT', name: 'Portugal', flagEmoji: '🇵🇹' },
  { code: 'UY', name: 'Uruguai', flagEmoji: '🇺🇾' },
  { code: 'CO', name: 'Colômbia', flagEmoji: '🇨🇴' },
  { code: 'FR', name: 'França', flagEmoji: '🇫🇷' },
  { code: 'IT', name: 'Itália', flagEmoji: '🇮🇹' },
  { code: 'DE', name: 'Alemanha', flagEmoji: '🇩🇪' },
  { code: 'MX', name: 'México', flagEmoji: '🇲🇽' },
  { code: 'US', name: 'Estados Unidos', flagEmoji: '🇺🇸' },
];

const LEAGUES = [
  {
    slug: 'liga-brasileira',
    name: 'VFA Liga Brasileira',
    shortName: 'Liga Brasileira',
    continent: 'SOUTH_AMERICA' as const,
    nationCode: 'BR',
    accent: '#00e08f',
    sortOrder: 1,
    continentalSlug: 'vfa-libertadores',
    clubs: [
      { name: 'Verdão Virtual FC', short: 'Verdão', abbr: 'VVF', color: '#0f9d58', owner: 'lucas_vfa' },
      { name: 'Rubro-Negro Digital', short: 'Rubro-Negro', abbr: 'RND', color: '#d32f2f', owner: 'gabriel.rnd' },
      { name: 'Tricolor Paulista RB', short: 'Tricolor RB', abbr: 'TRB', color: '#c62828', owner: 'pedro_trb' },
      { name: 'Alvinegro Praiano', short: 'Alvinegro', abbr: 'ALP', color: '#eceff1', owner: 'santos.alp' },
      { name: 'Cruz Azul Mineiro', short: 'Cruz Azul MG', abbr: 'CAM', color: '#1565c0', owner: 'mineiro_cam' },
      { name: 'Gaúcho United', short: 'Gaúcho', abbr: 'GAU', color: '#0277bd', owner: 'porto.gau' },
    ],
  },
  {
    slug: 'liga-argentina',
    name: 'VFA Liga Argentina',
    shortName: 'Liga Argentina',
    continent: 'SOUTH_AMERICA' as const,
    nationCode: 'AR',
    accent: '#4fc3f7',
    sortOrder: 2,
    continentalSlug: 'vfa-libertadores',
    clubs: [
      { name: 'Xeneize Virtual', short: 'Xeneize', abbr: 'XEN', color: '#1a237e', owner: 'martin_xen' },
      { name: 'Millonarios del Plata', short: 'Millonarios', abbr: 'MDP', color: '#e53935', owner: 'nico.mdp' },
      { name: 'Academia Rosarina', short: 'Academia', abbr: 'ACR', color: '#00acc1', owner: 'rosario_acr' },
      { name: 'Ciclón del Sur', short: 'Ciclón', abbr: 'CDS', color: '#3949ab', owner: 'sur.cds' },
      { name: 'Rojo de Avellaneda', short: 'Rojo', abbr: 'ROJ', color: '#b71c1c', owner: 'ave_roj' },
      { name: 'Fortín Mendocino', short: 'Fortín', abbr: 'FOR', color: '#fbc02d', owner: 'mendoza.for' },
    ],
  },
  {
    slug: 'premier-league',
    name: 'VFA Premier League',
    shortName: 'Premier League',
    continent: 'EUROPE' as const,
    nationCode: 'EN',
    accent: '#7e57c2',
    sortOrder: 3,
    continentalSlug: 'vfa-champions-league',
    clubs: [
      { name: 'Northside Rovers', short: 'Northside', abbr: 'NSR', color: '#c62828', owner: 'james_nsr' },
      { name: 'Thames City FC', short: 'Thames City', abbr: 'TCF', color: '#039be5', owner: 'oliver.tcf' },
      { name: 'Kings Park United', short: 'Kings Park', abbr: 'KPU', color: '#283593', owner: 'harry_kpu' },
      { name: 'Redbridge Athletic', short: 'Redbridge', abbr: 'RBA', color: '#ef6c00', owner: 'jack.rba' },
      { name: 'Ironside Wanderers', short: 'Ironside', abbr: 'IRW', color: '#455a64', owner: 'george_irw' },
      { name: 'Seaport Albion', short: 'Seaport', abbr: 'SPA', color: '#00897b', owner: 'liam.spa' },
    ],
  },
  {
    slug: 'laliga',
    name: 'VFA LaLiga',
    shortName: 'LaLiga',
    continent: 'EUROPE' as const,
    nationCode: 'ES',
    accent: '#ff7043',
    sortOrder: 4,
    continentalSlug: 'vfa-champions-league',
    clubs: [
      { name: 'Real Castilla CF', short: 'Real Castilla', abbr: 'RCC', color: '#eceff1', owner: 'sergio_rcc' },
      { name: 'Blaugrana Virtual', short: 'Blaugrana', abbr: 'BLV', color: '#0d47a1', owner: 'pau.blv' },
      { name: 'Atlético del Manzanares', short: 'Atlético M.', abbr: 'ADM', color: '#c62828', owner: 'diego_adm' },
      { name: 'Sevilla Digital', short: 'Sevilla D.', abbr: 'SVD', color: '#d32f2f', owner: 'javi.svd' },
      { name: 'Athletic Bilbao Sim', short: 'Athletic Sim', abbr: 'ABS', color: '#b71c1c', owner: 'iker_abs' },
      { name: 'Valencia Esports CF', short: 'Valencia E.', abbr: 'VEC', color: '#f9a825', owner: 'marc.vec' },
    ],
  },
];

const FIRST_NAMES = [
  'Joãozinho', 'Miguel', 'Arthur', 'Bernardo', 'Heitor', 'Davi', 'Lorenzo', 'Théo', 'Pedro',
  'Gabriel', 'Enzo', 'Matheus', 'Lucas', 'Benjamin', 'Nicolas', 'Guilherme', 'Rafael', 'Joaquim',
  'Samuel', 'Vicente', 'Santiago', 'Mateo', 'Thiago', 'Bruno', 'Diego', 'Facundo', 'Franco',
  'Alex', 'Jamie', 'Ollie', 'Ryan', 'Kai', 'Leo', 'Marc', 'Pau', 'Iker', 'Unai', 'Hugo',
];

const NICKNAMES = [
  'Foguete', 'Trator', 'Maestro', 'Xerife', 'Muralha', 'Fenômeno', 'Canhão', 'Pantera',
  'Relâmpago', 'Coringa', 'Furacão', 'Sniper', 'Titan', 'Gladiador', 'Mago',
];

const POSITIONS = ['GOALKEEPER', 'DEFENDER', 'MIDFIELDER', 'FORWARD'] as const;

const NEWS_CATEGORIES = [
  { name: 'VFA', color: '#00e08f', sortOrder: 1 },
  { name: 'Transferências', color: '#1e6bff', sortOrder: 2 },
  { name: 'Clubes', color: '#7e57c2', sortOrder: 3 },
  { name: 'Jogadores', color: '#26a69a', sortOrder: 4 },
  { name: 'Competições', color: '#ffb703', sortOrder: 5 },
  { name: 'Mercado', color: '#ef6c00', sortOrder: 6 },
  { name: 'Resultados', color: '#ec407a', sortOrder: 7 },
  { name: 'Comunicados oficiais', color: '#90a4ae', sortOrder: 8 },
];

/* ── Execução ──────────────────────────────────────────────── */

async function main() {
  const url = process.env.DATABASE_URL;
  if (!url) {
    console.error('\n✗ DATABASE_URL não definida. Copie .env.example para .env.local.\n');
    process.exit(1);
  }

  const client = postgres(url, { max: 1, prepare: false });
  const db = drizzle(client, { schema });

  const log = (message: string) => console.log(`  ${message}`);

  try {
    console.log('\nSeed de demonstração da VFA\n');

    /* ── Configurações ── */
    await db
      .insert(appSettings)
      .values({
        key: 'site',
        value: {
          name: 'VFA',
          fullName: 'Virtual Football Association',
          tagline: 'Os melhores clubes de futebol 3v3 do Roblox.',
          logoUrl: null,
          description:
            'Site oficial da VFA — resultados, tabelas, estatísticas e notícias do futebol 3v3 no Roblox.',
          discordInviteUrl: null,
        },
      })
      .onConflictDoNothing();
    log('✓ Configurações iniciais');

    /* ── Nações ── */
    const nationRows = await db
      .insert(nations)
      .values(NATIONS)
      .onConflictDoNothing()
      .returning();

    const allNations =
      nationRows.length > 0 ? nationRows : await db.select().from(nations);
    const nationByCode = new Map(allNations.map((nation) => [nation.code, nation]));
    log(`✓ ${allNations.length} nações`);

    /* ── Temporada ── */
    const year = 2026;
    await db.update(seasons).set({ isActive: false });

    const [season] = await db
      .insert(seasons)
      .values({
        year,
        name: `Temporada ${year}`,
        isActive: true,
        tagline: 'Os melhores clubes de futebol 3v3 do Roblox.',
        startDate: new Date(year, 1, 1),
      })
      .onConflictDoUpdate({
        target: seasons.year,
        set: { isActive: true, name: `Temporada ${year}` },
      })
      .returning();

    log(`✓ ${season.name}`);

    /* ── Ligas, clubes e elencos ── */
    const leagueIds = new Map<string, string>();
    const clubsByLeague = new Map<string, { id: string; name: string; abbr: string }[]>();
    const playersByClub = new Map<string, { id: string; name: string }[]>();
    let playerCount = 0;

    for (const leagueSpec of LEAGUES) {
      const nation = nationByCode.get(leagueSpec.nationCode);

      const [league] = await db
        .insert(schema.leagues)
        .values({
          slug: leagueSpec.slug,
          name: leagueSpec.name,
          shortName: leagueSpec.shortName,
          continent: leagueSpec.continent,
          nationId: nation?.id ?? null,
          accent: leagueSpec.accent,
          sortOrder: leagueSpec.sortOrder,
        })
        .onConflictDoUpdate({
          target: schema.leagues.slug,
          set: { name: leagueSpec.name, accent: leagueSpec.accent },
        })
        .returning();

      leagueIds.set(leagueSpec.slug, league.id);

      // Zonas de classificação continental — item 10 do escopo.
      await db.delete(qualificationZones).where(eq(qualificationZones.leagueId, league.id));
      await db.insert(qualificationZones).values([
        {
          leagueId: league.id,
          label:
            leagueSpec.continentalSlug === 'vfa-libertadores' ? 'Libertadores' : 'Champions League',
          color: leagueSpec.continentalSlug === 'vfa-libertadores' ? '#22c55e' : '#3b82f6',
          fromPosition: 1,
          toPosition: 4,
          targetSlug: leagueSpec.continentalSlug,
          sortOrder: 0,
        },
        {
          leagueId: league.id,
          label: 'Fora da zona de classificação',
          color: '#64748b',
          fromPosition: 5,
          toPosition: 6,
          targetSlug: null,
          sortOrder: 1,
        },
      ]);

      const leagueClubs: { id: string; name: string; abbr: string }[] = [];

      for (const clubSpec of leagueSpec.clubs) {
        const [club] = await db
          .insert(clubs)
          .values({
            slug: slugify(clubSpec.name),
            name: clubSpec.name,
            shortName: clubSpec.short,
            abbreviation: clubSpec.abbr,
            leagueId: league.id,
            nationId: nation?.id ?? null,
            primaryColor: clubSpec.color,
            secondaryColor: '#0b0f17',
            ownerName: clubSpec.owner,
            stadium: `Arena ${clubSpec.short}`,
            foundedAt: new Date(2024, between(0, 11), between(1, 28)),
            isDemo: true,
          })
          .onConflictDoUpdate({
            target: clubs.slug,
            set: { name: clubSpec.name, leagueId: league.id, isDemo: true },
          })
          .returning();

        leagueClubs.push({ id: club.id, name: club.name, abbr: club.abbreviation });

        await db
          .insert(clubSeasonMemberships)
          .values({ clubId: club.id, seasonId: season.id, leagueId: league.id })
          .onConflictDoNothing();

        // ── Elenco: 5 jogadores por clube (3v3 + reservas) ──
        const squad: { id: string; name: string }[] = [];

        for (let index = 0; index < 5; index += 1) {
          const first = pick(FIRST_NAMES);
          // Nomes precisam ser únicos: dois "Leo" em ligas diferentes deixariam
          // a artilharia ambígua para quem lê o site.
          const displayName = uniqueName(first);
          const username = `${slugify(first).replace(/-/g, '')}${clubSpec.abbr}${index + 1}`;

          const position =
            index === 0 ? 'GOALKEEPER' : index === 4 ? pick([...POSITIONS]) : POSITIONS[index];

          const [player] = await db
            .insert(players)
            .values({
              slug: slugify(`${displayName}-${clubSpec.abbr}-${index + 1}`),
              displayName,
              robloxUsername: username,
              nationId: pick(allNations).id,
              currentClubId: club.id,
              shirtNumber: index + 1,
              position,
              isActive: true,
              isDemo: true,
              joinedAt: new Date(year, 0, between(5, 25)),
            })
            .onConflictDoUpdate({
              target: players.robloxUsername,
              set: { currentClubId: club.id, isDemo: true },
            })
            .returning();

          squad.push({ id: player.id, name: player.displayName });
          playerCount += 1;

          await db.insert(transfers).values({
            playerId: player.id,
            fromClubId: null,
            toClubId: club.id,
            seasonId: season.id,
            type: 'SIGNING',
            occurredAt: new Date(year, 0, between(5, 25)),
            note: 'Contratação registrada na abertura da temporada.',
          });
        }

        // O primeiro jogador de campo vira capitão.
        await db.update(clubs).set({ captainId: squad[1].id }).where(eq(clubs.id, club.id));
        playersByClub.set(club.id, squad);
      }

      clubsByLeague.set(leagueSpec.slug, leagueClubs);
    }

    log(`✓ ${LEAGUES.length} ligas, ${LEAGUES.length * 6} clubes, ${playerCount} jogadores`);

    /* ── Competições das ligas ── */
    const leagueCompetitionIds = new Map<string, string>();

    for (const leagueSpec of LEAGUES) {
      const leagueId = leagueIds.get(leagueSpec.slug)!;

      const [competition] = await db
        .insert(competitions)
        .values({
          slug: leagueSpec.slug,
          name: leagueSpec.name,
          shortName: leagueSpec.shortName,
          type: 'LEAGUE',
          status: 'IN_PROGRESS',
          seasonId: season.id,
          leagueId,
          accent: leagueSpec.accent,
          sortOrder: leagueSpec.sortOrder,
          config: LEAGUE_PRESET,
          isDemo: true,
        })
        .onConflictDoUpdate({
          target: competitions.slug,
          set: { seasonId: season.id, config: LEAGUE_PRESET, isDemo: true },
        })
        .returning();

      leagueCompetitionIds.set(leagueSpec.slug, competition.id);

      const leagueClubs = clubsByLeague.get(leagueSpec.slug)!;

      await db.delete(competitionTeams).where(eq(competitionTeams.competitionId, competition.id));
      await db.insert(competitionTeams).values(
        leagueClubs.map((club, index) => ({
          competitionId: competition.id,
          clubId: club.id,
          seed: index + 1,
        })),
      );

      // ── Calendário: turno e returno ──
      await db.delete(matches).where(eq(matches.competitionId, competition.id));

      const fixtures = roundRobin(
        leagueClubs.map((club) => club.id),
        LEAGUE_PRESET.rounds,
      );

      const totalMatchdays = Math.max(...fixtures.map((fixture) => fixture.matchday));
      // Oito das dez rodadas já foram jogadas; as duas últimas ficam agendadas,
      // para que a home tenha ao mesmo tempo resultados e próximos jogos.
      const playedThrough = Math.max(1, totalMatchdays - 2);

      // O calendário é ancorado na data de hoje: as rodadas disputadas caem no
      // passado e as pendentes no futuro. Datar tudo em fevereiro deixaria a
      // seção "próxima partida" vazia sempre que o seed fosse rodado depois
      // do meio do ano.
      const startDate = new Date();
      startDate.setDate(startDate.getDate() - playedThrough * 7);
      startDate.setHours(19, 0, 0, 0);

      for (const fixture of fixtures) {
        const kickoff = new Date(startDate);
        kickoff.setDate(kickoff.getDate() + (fixture.matchday - 1) * 7);
        kickoff.setHours(19 + (fixture.matchday % 2), 0, 0, 0);

        const played = fixture.matchday <= playedThrough;
        const homeGoals = played ? weightedGoals() : null;
        const awayGoals = played ? weightedGoals() : null;

        const [match] = await db
          .insert(matches)
          .values({
            seasonId: season.id,
            competitionId: competition.id,
            homeClubId: fixture.home,
            awayClubId: fixture.away,
            matchday: fixture.matchday,
            kickoffAt: kickoff,
            status: played ? 'FINISHED' : 'SCHEDULED',
            homeScore: homeGoals,
            awayScore: awayGoals,
            venue: `Arena VFA ${fixture.matchday}`,
            isDemo: true,
          })
          .returning();

        if (played) {
          await recordEvents(db, match.id, fixture.home, fixture.away, homeGoals!, awayGoals!, playersByClub);
        }
      }
    }

    log('✓ Calendário e resultados das ligas');

    /* ── Recalcula as tabelas ── */
    // Importado aqui porque o motor usa a conexão de src/db.
    const { recomputeCompetition } = await import('../src/lib/engine/recompute');
    for (const competitionId of leagueCompetitionIds.values()) {
      await recomputeCompetition(competitionId);
    }
    log('✓ Tabelas calculadas');

    /* ── Mata-mata das ligas ── */
    for (const leagueSpec of LEAGUES) {
      const leagueId = leagueIds.get(leagueSpec.slug)!;

      const [playoff] = await db
        .insert(competitions)
        .values({
          slug: `${leagueSpec.slug}-mata-mata`,
          name: `${leagueSpec.shortName} — Mata-mata`,
          shortName: 'Playoff',
          type: 'LEAGUE_PLAYOFF',
          status: 'UPCOMING',
          seasonId: season.id,
          leagueId,
          parentSlug: leagueSpec.slug,
          accent: leagueSpec.accent,
          sortOrder: leagueSpec.sortOrder + 10,
          config: LEAGUE_PLAYOFF_PRESET,
          isDemo: true,
        })
        .onConflictDoUpdate({
          target: competitions.slug,
          set: { seasonId: season.id, config: LEAGUE_PLAYOFF_PRESET, isDemo: true },
        })
        .returning();

      const leagueClubs = clubsByLeague.get(leagueSpec.slug)!;
      await db.delete(competitionTeams).where(eq(competitionTeams.competitionId, playoff.id));
      await db.insert(competitionTeams).values(
        leagueClubs.map((club) => ({ competitionId: playoff.id, clubId: club.id })),
      );

      // Gera as fases (quartas → semi → final) a partir da tabela da liga:
      // 1º e 2º entram direto na semifinal, 3º×6º e 4º×5º nas quartas.
      const { generateKnockout: generateLeagueKnockout } = await import(
        '../src/lib/engine/generate'
      );

      await generateLeagueKnockout(playoff.id, {
        startAt: daysFromNow(-35, 20),
        daysBetweenRounds: 7,
        replaceExisting: true,
        venue: `Arena ${leagueSpec.shortName}`,
      });

      await playOutKnockout(db, playoff.id, playersByClub);
    }
    log('✓ Mata-mata das ligas disputado');

    /* ── Competições continentais ── */
    const continentals = [
      {
        slug: 'vfa-libertadores',
        name: 'VFA Libertadores',
        shortName: 'Libertadores',
        accent: '#22c55e',
        sortOrder: 30,
        leagueSlugs: ['liga-brasileira', 'liga-argentina'],
      },
      {
        slug: 'vfa-champions-league',
        name: 'VFA Champions League',
        shortName: 'Champions',
        accent: '#3b82f6',
        sortOrder: 31,
        leagueSlugs: ['premier-league', 'laliga'],
      },
    ];

    const { populateContinental } = await import('../src/lib/engine/generate');
    const { generateKnockout } = await import('../src/lib/engine/generate');

    const championIds: string[] = [];

    for (const spec of continentals) {
      const [competition] = await db
        .insert(competitions)
        .values({
          slug: spec.slug,
          name: spec.name,
          shortName: spec.shortName,
          type: 'CONTINENTAL',
          status: 'IN_PROGRESS',
          seasonId: season.id,
          accent: spec.accent,
          sortOrder: spec.sortOrder,
          config: CONTINENTAL_PRESET,
          isDemo: true,
        })
        .onConflictDoUpdate({
          target: competitions.slug,
          set: { seasonId: season.id, config: CONTINENTAL_PRESET, isDemo: true },
        })
        .returning();

      // Puxa os 4 primeiros de cada liga pelas zonas de classificação.
      await populateContinental(competition.id);

      await generateKnockout(competition.id, {
        startAt: daysFromNow(-21, 20),
        daysBetweenRounds: 7,
        replaceExisting: true,
        venue: 'Arena Continental VFA',
      });

      // Simula o torneio inteiro até sair o campeão.
      const champion = await playOutKnockout(db, competition.id, playersByClub);
      if (champion) championIds.push(champion);
    }

    log('✓ Libertadores e Champions League disputadas');

    /* ── Final Intercontinental ── */
    const [intercontinental] = await db
      .insert(competitions)
      .values({
        slug: 'vfa-intercontinental',
        name: 'VFA Intercontinental',
        shortName: 'Intercontinental',
        type: 'INTERCONTINENTAL',
        status: 'IN_PROGRESS',
        seasonId: season.id,
        parentSlug: 'vfa-libertadores,vfa-champions-league',
        accent: '#ffb703',
        sortOrder: 40,
        config: INTERCONTINENTAL_PRESET,
        isDemo: true,
      })
      .onConflictDoUpdate({
        target: competitions.slug,
        set: { seasonId: season.id, config: INTERCONTINENTAL_PRESET, isDemo: true },
      })
      .returning();

    if (championIds.length === 2) {
      const { populateIntercontinental } = await import('../src/lib/engine/generate');
      await populateIntercontinental(intercontinental.id, [
        'vfa-libertadores',
        'vfa-champions-league',
      ]);

      await generateKnockout(intercontinental.id, {
        startAt: daysFromNow(-4, 21),
        daysBetweenRounds: 7,
        replaceExisting: true,
        venue: 'Estádio Intercontinental VFA',
      });

      await playOutKnockout(db, intercontinental.id, playersByClub);
      log('✓ Final Intercontinental disputada');
    } else {
      log('• Intercontinental criada, aguardando os campeões continentais');
    }

    /* ── Notícias ── */
    const categoryRows = await db
      .insert(newsCategories)
      .values(
        NEWS_CATEGORIES.map((category) => ({
          slug: slugify(category.name),
          name: category.name,
          color: category.color,
          sortOrder: category.sortOrder,
        })),
      )
      .onConflictDoNothing()
      .returning();

    const allCategories =
      categoryRows.length > 0 ? categoryRows : await db.select().from(newsCategories);
    const categoryBySlug = new Map(allCategories.map((category) => [category.slug, category]));

    const [intercontinentalRow] = await db
      .select()
      .from(competitions)
      .where(eq(competitions.slug, 'vfa-intercontinental'))
      .limit(1);

    let intercontinentalChampion = 'o campeão intercontinental';
    if (intercontinentalRow?.championClubId) {
      const [champion] = await db
        .select({ name: clubs.name })
        .from(clubs)
        .where(eq(clubs.id, intercontinentalRow.championClubId))
        .limit(1);
      if (champion) intercontinentalChampion = champion.name;
    }

    const articles = [
      {
        title: `${intercontinentalChampion} conquista a primeira Intercontinental da VFA`,
        subtitle: 'Decisão entre os campeões da Libertadores e da Champions League fecha a temporada',
        category: 'competicoes',
        featured: true,
        daysAgo: 1,
        body: `<p>A primeira edição da <strong>VFA Intercontinental</strong> terminou com o título de ${intercontinentalChampion}, que superou o adversário na decisão em jogo único.</p><h2>Como se chegou até aqui</h2><p>O caminho começou nas quatro ligas nacionais. Os quatro primeiros de cada liga sul-americana avançaram para a Libertadores, e os quatro primeiros de cada liga europeia foram para a Champions League. Os dois campeões continentais se encontraram na decisão.</p><p>A temporada seguinte já está sendo desenhada pela organização, com a possibilidade de aumento no número de clubes por liga.</p>`,
      },
      {
        title: 'Zona de classificação define os oito clubes da Libertadores',
        subtitle: 'Brasileira e Argentina enviam quatro representantes cada',
        category: 'competicoes',
        featured: false,
        daysAgo: 12,
        body: `<p>Com o encerramento das rodadas decisivas, os oito participantes da <strong>VFA Libertadores</strong> estão definidos. Quatro vêm da Liga Brasileira e quatro da Liga Argentina, seguindo as faixas de classificação configuradas pela organização.</p><p>O formato é de mata-mata direto: quartas de final, semifinal e final em jogo único.</p>`,
      },
      {
        title: 'Artilharia da temporada tem disputa aberta até a última rodada',
        subtitle: 'Diferença entre os três primeiros colocados é mínima',
        category: 'jogadores',
        featured: false,
        daysAgo: 18,
        body: `<p>A briga pela artilharia da VFA chega ao fim da fase de pontos corridos sem favorito definido. Os líderes estão separados por poucos gols, e as rodadas finais devem decidir o troféu.</p><p>Confira a lista completa na aba de <a href="/estatisticas">estatísticas</a>.</p>`,
      },
      {
        title: 'Janela de transferências movimenta elencos das quatro ligas',
        subtitle: 'Clubes reforçam o setor ofensivo para o mata-mata',
        category: 'transferencias',
        featured: false,
        daysAgo: 25,
        body: `<p>A janela intermediária da VFA registrou movimentação em todas as ligas. Os clubes que estão na zona de classificação continental priorizaram reforços no ataque.</p><p>Todo o histórico de transferências fica registrado no perfil de cada jogador.</p>`,
      },
      {
        title: 'Comunicado oficial: regras de pontuação e desempate da temporada',
        subtitle: 'Critérios ficam configuráveis e podem ser ajustados entre temporadas',
        category: 'comunicados-oficiais',
        featured: false,
        daysAgo: 40,
        body: `<p>A organização da VFA confirma os critérios da temporada:</p><ul><li>Vitória: 3 pontos</li><li>Empate: 1 ponto</li><li>Derrota: 0 pontos</li></ul><h3>Desempate</h3><ol><li>Pontos</li><li>Número de vitórias</li><li>Saldo de gols</li><li>Gols marcados</li><li>Confronto direto</li></ol><p>Os critérios são configuráveis pelo painel administrativo e podem mudar em temporadas futuras sem alteração no sistema.</p>`,
      },
      {
        title: 'Clubes apresentam identidade visual para a temporada 2026',
        subtitle: 'Escudos e cores oficiais estão disponíveis nas páginas de cada clube',
        category: 'clubes',
        featured: false,
        daysAgo: 55,
        body: `<p>Os 24 clubes da VFA apresentaram suas identidades visuais para a temporada. Cada página de clube exibe as cores oficiais e o elenco completo.</p>`,
      },
    ];

    for (const article of articles) {
      const publishedAt = new Date();
      publishedAt.setDate(publishedAt.getDate() - article.daysAgo);

      await db
        .insert(news)
        .values({
          slug: slugify(article.title),
          title: article.title,
          subtitle: article.subtitle,
          content: article.body,
          excerpt: article.subtitle,
          categoryId: categoryBySlug.get(article.category)?.id ?? null,
          status: 'PUBLISHED',
          isFeatured: article.featured,
          publishedAt,
          isDemo: true,
        })
        .onConflictDoNothing();
    }

    log(`✓ ${articles.length} notícias`);

    /* ── Recalcula tudo uma última vez ── */
    const { recomputeSeason } = await import('../src/lib/engine/recompute');
    await recomputeSeason(season.id);
    log('✓ Recálculo final');

    console.log('\n✓ Seed concluído. Rode `npm run dev` e abra http://localhost:3000\n');
    console.log('  Os dados criados aqui aparecem marcados como demonstração no site.');
    console.log('  Para removê-los depois: npm run db:reset\n');
  } catch (error) {
    console.error('\n✗ Falha no seed:\n', error, '\n');
    process.exitCode = 1;
  } finally {
    await client.end();
  }
}

/* ── Auxiliares ────────────────────────────────────────────── */

/** Data relativa a hoje, com hora fixa. */
function daysFromNow(days: number, hour: number): Date {
  const date = new Date();
  date.setDate(date.getDate() + days);
  date.setHours(hour, 0, 0, 0);
  return date;
}

/** Distribuição de gols parecida com a de um jogo 3v3: placares baixos-médios. */
function weightedGoals(): number {
  const roll = random();
  if (roll < 0.14) return 0;
  if (roll < 0.38) return 1;
  if (roll < 0.64) return 2;
  if (roll < 0.84) return 3;
  if (roll < 0.94) return 4;
  return 5;
}

type Db = ReturnType<typeof drizzle<typeof schema>>;

/** Cria escalações e eventos coerentes com o placar da partida. */
async function recordEvents(
  db: Db,
  matchId: string,
  homeClubId: string,
  awayClubId: string,
  homeGoals: number,
  awayGoals: number,
  playersByClub: Map<string, { id: string; name: string }[]>,
) {
  const homeSquad = playersByClub.get(homeClubId) ?? [];
  const awaySquad = playersByClub.get(awayClubId) ?? [];
  if (homeSquad.length === 0 || awaySquad.length === 0) return;

  // Escalação: os 4 primeiros do elenco entram (3 em campo + 1 reserva).
  const appearances = [
    ...homeSquad.slice(0, 4).map((player, index) => ({
      matchId,
      playerId: player.id,
      clubId: homeClubId,
      minutes: index < 3 ? 20 : 8,
      started: index < 3,
    })),
    ...awaySquad.slice(0, 4).map((player, index) => ({
      matchId,
      playerId: player.id,
      clubId: awayClubId,
      minutes: index < 3 ? 20 : 8,
      started: index < 3,
    })),
  ];

  await db.insert(matchAppearances).values(appearances).onConflictDoNothing();

  const events: (typeof matchEvents.$inferInsert)[] = [];

  const addGoals = (squad: { id: string }[], clubId: string, goals: number) => {
    // Goleiro (índice 0) não marca; os demais dividem os gols.
    const scorers = squad.slice(1, 4);
    for (let index = 0; index < goals; index += 1) {
      const scorer = pick(scorers);
      const assistant = scorers.filter((player) => player.id !== scorer.id);

      events.push({
        matchId,
        clubId,
        playerId: scorer.id,
        // Nem todo gol tem assistência: ~35% saem de jogada individual.
        assistPlayerId: random() > 0.35 && assistant.length > 0 ? pick(assistant).id : null,
        type: random() > 0.9 ? 'PENALTY_GOAL' : 'GOAL',
        minute: between(1, 20),
      });
    }
  };

  addGoals(homeSquad, homeClubId, homeGoals);
  addGoals(awaySquad, awayClubId, awayGoals);

  // Cartões esporádicos.
  for (const [squad, clubId] of [
    [homeSquad, homeClubId],
    [awaySquad, awayClubId],
  ] as const) {
    if (random() > 0.72) {
      events.push({
        matchId,
        clubId,
        playerId: pick(squad.slice(1, 4)).id,
        type: random() > 0.9 ? 'RED_CARD' : 'YELLOW_CARD',
        minute: between(5, 20),
      });
    }
  }

  if (events.length > 0) await db.insert(matchEvents).values(events);
}

/**
 * Joga um mata-mata inteiro até sair o campeão, avançando fase a fase.
 * Devolve o id do clube campeão.
 */
async function playOutKnockout(
  db: Db,
  competitionId: string,
  playersByClub: Map<string, { id: string; name: string }[]>,
): Promise<string | null> {
  const { advanceBracket } = await import('../src/lib/engine/generate');
  const { recomputeCompetition, resolveChampion } = await import('../src/lib/engine/recompute');

  // No máximo 6 fases: mais que isso significaria uma chave impossível.
  for (let round = 0; round < 6; round += 1) {
    const pending = await db
      .select()
      .from(matches)
      .where(sql`${matches.competitionId} = ${competitionId} and ${matches.status} = 'SCHEDULED'`);

    if (pending.length === 0) break;

    for (const match of pending) {
      // O teto vem ANTES da checagem de empate. Ao contrário, um 5×4 viraria
      // 4×4 depois do clamp — um empate sem pênaltis, que deixa o confronto
      // sem vencedor e trava o chaveamento na fase seguinte.
      const homeGoals = Math.min(weightedGoals(), 4);
      const awayGoals = Math.min(weightedGoals(), 4);

      let homePenalties: number | null = null;
      let awayPenalties: number | null = null;

      // Mata-mata precisa de vencedor: empate vai para os pênaltis.
      if (homeGoals === awayGoals) {
        homePenalties = between(3, 5);
        awayPenalties = homePenalties > 3 ? homePenalties - 1 - between(0, 1) : homePenalties + 1 + between(0, 1);
        if (awayPenalties === homePenalties) awayPenalties = homePenalties + 1;
        if (awayPenalties < 0) awayPenalties = homePenalties + 1;
      }

      await db
        .update(matches)
        .set({
          homeScore: homeGoals,
          awayScore: awayGoals,
          homePenalties,
          awayPenalties,
          status: 'FINISHED',
        })
        .where(eq(matches.id, match.id));

      await recordEvents(
        db,
        match.id,
        match.homeClubId,
        match.awayClubId,
        homeGoals,
        awayGoals,
        playersByClub,
      );
    }

    await recomputeCompetition(competitionId);
    await advanceBracket(competitionId);
  }

  await resolveChampion(competitionId);

  const [competition] = await db
    .select({ slug: competitions.slug, championClubId: competitions.championClubId })
    .from(competitions)
    .where(eq(competitions.id, competitionId))
    .limit(1);

  if (!competition?.championClubId) {
    // Acontece quando algum confronto terminou empatado sem pênaltis: sem
    // vencedor, a fase seguinte não é criada. Melhor avisar alto do que
    // deixar o site com um chaveamento pela metade sem explicação.
    console.warn(
      `  ! ${competition?.slug ?? competitionId}: chaveamento não chegou ao campeão — algum confronto ficou sem vencedor.`,
    );
  }

  return competition?.championClubId ?? null;
}

void main();
