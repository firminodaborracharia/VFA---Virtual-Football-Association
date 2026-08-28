/**
 * Traduções da interface — português, inglês e espanhol.
 *
 * ── O que entra aqui e o que não entra ──
 *
 * Aqui ficam os textos FIXOS: menu, rótulos de coluna, títulos de seção,
 * mensagens de lista vazia. São escritos por mim e existem nos três idiomas.
 *
 * O que você digita no painel — notícia, nome de clube, apelido de jogador —
 * não passa por este arquivo. Nenhum programa traduz "Rubro-Negro Digital"
 * sozinho sem inventar besteira, e ninguém quer ver o nome do seu clube
 * traduzido. As notícias têm um caminho próprio: campos opcionais de título e
 * conteúdo em cada idioma, preenchidos por quem escreve.
 *
 * ── Como está organizado ──
 *
 * O dicionário português é a FONTE. Os outros dois são tipados a partir dele,
 * então esquecer uma chave em inglês ou espanhol vira erro de compilação, e
 * não um texto em português aparecendo no meio da página em produção.
 */

export const LOCALES = ['pt', 'en', 'es'] as const;
export type Locale = (typeof LOCALES)[number];

export const DEFAULT_LOCALE: Locale = 'pt';

export const LOCALE_NAMES: Record<Locale, string> = {
  pt: 'Português',
  en: 'English',
  es: 'Español',
};

/** Código curto mostrado no botão do cabeçalho. */
export const LOCALE_SHORT: Record<Locale, string> = {
  pt: 'PT',
  en: 'EN',
  es: 'ES',
};

/** Usado no atributo `lang` do <html> e na formatação de datas e números. */
export const LOCALE_TAGS: Record<Locale, string> = {
  pt: 'pt-BR',
  en: 'en-US',
  es: 'es-ES',
};

const pt = {
  nav: {
    home: 'Início',
    players: 'Jogadores',
    clubs: 'Clubes',
    standings: 'Classificação',
    matches: 'Partidas',
    competitions: 'Competições',
    highlights: 'Destaques',
    news: 'Notícias',
    stats: 'Estatísticas',
    admin: 'Administração',
    menu: 'Menu',
    openMenu: 'Abrir menu',
    closeMenu: 'Fechar menu',
    search: 'Buscar',
    searchSite: 'Buscar no site',
    signIn: 'Entrar',
    language: 'Idioma',
  },

  home: {
    season: 'Temporada',
    seasonWord: 'Temporada',
    viewMatches: 'Ver partidas',
    viewStandings: 'Ver classificação',
    clubsCount: 'Clubes',
    playersCount: 'Jogadores',
    matchesCount: 'Partidas',
    goalsCount: 'Gols',
    nextMatch: 'Próxima partida',
    allMatches: 'Todas as partidas',
    highlights: 'Destaques',
    viewAll: 'Ver todos',
    latestResults: 'Últimos resultados',
    standings: 'Classificação',
    fullTable: 'Tabela completa',
    competitions: 'Competições',
    allNews: 'Todas as notícias',
    nextFixture: 'Próximo confronto',
    tableLeader: 'Líder da tabela',
    topScorer: 'Artilheiro',
    topAssists: 'Líder de assistências',
    points: 'pontos',
    goal: 'gol',
    goals: 'gols',
    assists: 'assistências',
    noClub: 'sem clube',
    noSeason: 'Nenhuma temporada cadastrada ainda',
    noSeasonHelp:
      'Crie a primeira temporada no painel administrativo, ou rode o seed de demonstração para ver o site preenchido.',
    goToAdmin: 'Ir para o painel',
    noMatches: 'Nenhuma partida agendada',
    noMatchesHelp:
      'Quando o calendário da temporada for publicado, o próximo jogo aparece aqui.',
    noNews: 'Nenhuma notícia publicada',
    noNewsHelp: 'As matérias aparecem aqui depois de publicadas no painel.',
  },

  standings: {
    title: 'Classificação',
    subtitle: 'As tabelas são recalculadas automaticamente a cada resultado registrado.',
    position: '#',
    club: 'Clube',
    points: 'P',
    played: 'J',
    won: 'V',
    drawn: 'E',
    lost: 'D',
    goalsFor: 'GP',
    goalsAgainst: 'GC',
    goalDifference: 'SG',
    percentage: '%',
    lastFive: 'Últimos 5',
    viewCompetition: 'Ver competição',
    empty: 'Tabela ainda vazia',
    emptyHelp:
      'A classificação aparece assim que as primeiras partidas desta competição forem registradas.',
    win: 'Vitória',
    draw: 'Empate',
    loss: 'Derrota',
    winShort: 'V',
    drawShort: 'E',
    lossShort: 'D',
  },

  pages: {
    playersEyebrow: 'Elenco da liga',
    playersTitle: 'Jogadores',
    clubsEyebrow: 'Clubes da VFA',
    clubsTitle: 'Clubes',
    matchesEyebrow: 'Central de partidas',
    matchesTitle: 'Partidas',
    competitionsEyebrow: 'Torneios da temporada',
    competitionsTitle: 'Competições',
    highlightsEyebrow: 'Os melhores da temporada',
    highlightsTitle: 'Destaques',
    newsEyebrow: 'Cobertura oficial',
    newsTitle: 'Notícias',
    statsEyebrow: 'Números da temporada',
    statsTitle: 'Estatísticas',
  },

  player: {
    live: 'Ao vivo',
    finished: 'Final',
    scheduled: 'Agendada',
    round: 'Rodada',
    viewProfile: 'Ver perfil',
    robloxProfile: 'Ver perfil Roblox',
  },

  footer: {
    notAffiliated: 'Não afiliado à Roblox Corporation. Dados de perfil obtidos da API pública do Roblox.',
    discord: 'Servidor no Discord',
    amateur: 'Competição amadora de futebol 3v3 no Roblox.',
  },

  player_actions: {
    retry: 'Tentar novamente',
    backHome: 'Voltar ao início',
  },
};

/**
 * O formato do português vira o contrato dos outros idiomas.
 *
 * Sem `as const` de propósito: com ele, cada valor viraria o tipo literal do
 * texto em português ("Jogadores" em vez de `string`), e o inglês só
 * compilaria se dissesse "Jogadores" também. O que precisa ser igual entre os
 * três é o conjunto de CHAVES, não o conteúdo.
 */
export type Dictionary = typeof pt;

const en: Dictionary = {
  nav: {
    home: 'Home',
    players: 'Players',
    clubs: 'Clubs',
    standings: 'Table',
    matches: 'Fixtures',
    competitions: 'Competitions',
    highlights: 'Highlights',
    news: 'News',
    stats: 'Stats',
    admin: 'Admin',
    menu: 'Menu',
    openMenu: 'Open menu',
    closeMenu: 'Close menu',
    search: 'Search',
    searchSite: 'Search the site',
    signIn: 'Sign in',
    language: 'Language',
  },

  home: {
    season: 'Season',
    seasonWord: 'Season',
    viewMatches: 'View fixtures',
    viewStandings: 'View table',
    clubsCount: 'Clubs',
    playersCount: 'Players',
    matchesCount: 'Matches',
    goalsCount: 'Goals',
    nextMatch: 'Next match',
    allMatches: 'All fixtures',
    highlights: 'Highlights',
    viewAll: 'View all',
    latestResults: 'Latest results',
    standings: 'Table',
    fullTable: 'Full table',
    competitions: 'Competitions',
    allNews: 'All news',
    nextFixture: 'Next fixture',
    tableLeader: 'Table leader',
    topScorer: 'Top scorer',
    topAssists: 'Most assists',
    points: 'points',
    goal: 'goal',
    goals: 'goals',
    assists: 'assists',
    noClub: 'no club',
    noSeason: 'No season registered yet',
    noSeasonHelp:
      'Create the first season in the admin panel, or run the demo seed to see the site filled in.',
    goToAdmin: 'Go to the panel',
    noMatches: 'No matches scheduled',
    noMatchesHelp: 'Once the season calendar is published, the next fixture shows up here.',
    noNews: 'No news published',
    noNewsHelp: 'Articles appear here after being published in the panel.',
  },

  standings: {
    title: 'Table',
    subtitle: 'Tables are recalculated automatically after every result.',
    position: '#',
    club: 'Club',
    points: 'PTS',
    played: 'P',
    won: 'W',
    drawn: 'D',
    lost: 'L',
    goalsFor: 'GF',
    goalsAgainst: 'GA',
    goalDifference: 'GD',
    percentage: '%',
    lastFive: 'Last 5',
    viewCompetition: 'View competition',
    empty: 'Table is still empty',
    emptyHelp: 'The table appears as soon as the first matches of this competition are recorded.',
    win: 'Win',
    draw: 'Draw',
    loss: 'Loss',
    winShort: 'W',
    drawShort: 'D',
    lossShort: 'L',
  },

  pages: {
    playersEyebrow: 'League squads',
    playersTitle: 'Players',
    clubsEyebrow: 'VFA clubs',
    clubsTitle: 'Clubs',
    matchesEyebrow: 'Match centre',
    matchesTitle: 'Fixtures',
    competitionsEyebrow: 'Season tournaments',
    competitionsTitle: 'Competitions',
    highlightsEyebrow: 'Best of the season',
    highlightsTitle: 'Highlights',
    newsEyebrow: 'Official coverage',
    newsTitle: 'News',
    statsEyebrow: 'Season numbers',
    statsTitle: 'Stats',
  },

  player: {
    live: 'Live',
    finished: 'Full time',
    scheduled: 'Scheduled',
    round: 'Round',
    viewProfile: 'View profile',
    robloxProfile: 'View Roblox profile',
  },

  footer: {
    notAffiliated:
      'Not affiliated with Roblox Corporation. Profile data from the public Roblox API.',
    discord: 'Discord server',
    amateur: 'Amateur 3v3 football competition on Roblox.',
  },

  player_actions: {
    retry: 'Try again',
    backHome: 'Back to home',
  },
};

const es: Dictionary = {
  nav: {
    home: 'Inicio',
    players: 'Jugadores',
    clubs: 'Clubes',
    standings: 'Clasificación',
    matches: 'Partidos',
    competitions: 'Competiciones',
    highlights: 'Destacados',
    news: 'Noticias',
    stats: 'Estadísticas',
    admin: 'Administración',
    menu: 'Menú',
    openMenu: 'Abrir menú',
    closeMenu: 'Cerrar menú',
    search: 'Buscar',
    searchSite: 'Buscar en el sitio',
    signIn: 'Entrar',
    language: 'Idioma',
  },

  home: {
    season: 'Temporada',
    seasonWord: 'Temporada',
    viewMatches: 'Ver partidos',
    viewStandings: 'Ver clasificación',
    clubsCount: 'Clubes',
    playersCount: 'Jugadores',
    matchesCount: 'Partidos',
    goalsCount: 'Goles',
    nextMatch: 'Próximo partido',
    allMatches: 'Todos los partidos',
    highlights: 'Destacados',
    viewAll: 'Ver todos',
    latestResults: 'Últimos resultados',
    standings: 'Clasificación',
    fullTable: 'Tabla completa',
    competitions: 'Competiciones',
    allNews: 'Todas las noticias',
    nextFixture: 'Próximo enfrentamiento',
    tableLeader: 'Líder de la tabla',
    topScorer: 'Máximo goleador',
    topAssists: 'Líder en asistencias',
    points: 'puntos',
    goal: 'gol',
    goals: 'goles',
    assists: 'asistencias',
    noClub: 'sin club',
    noSeason: 'Todavía no hay ninguna temporada',
    noSeasonHelp:
      'Crea la primera temporada en el panel de administración, o ejecuta el seed de demostración para ver el sitio con datos.',
    goToAdmin: 'Ir al panel',
    noMatches: 'No hay partidos programados',
    noMatchesHelp: 'Cuando se publique el calendario, el próximo partido aparecerá aquí.',
    noNews: 'No hay noticias publicadas',
    noNewsHelp: 'Los artículos aparecen aquí después de publicarse en el panel.',
  },

  standings: {
    title: 'Clasificación',
    subtitle: 'Las tablas se recalculan automáticamente con cada resultado registrado.',
    position: '#',
    club: 'Club',
    points: 'PTS',
    played: 'PJ',
    won: 'G',
    drawn: 'E',
    lost: 'P',
    goalsFor: 'GF',
    goalsAgainst: 'GC',
    goalDifference: 'DG',
    percentage: '%',
    lastFive: 'Últimos 5',
    viewCompetition: 'Ver competición',
    empty: 'La tabla aún está vacía',
    emptyHelp:
      'La clasificación aparece en cuanto se registren los primeros partidos de esta competición.',
    win: 'Victoria',
    draw: 'Empate',
    loss: 'Derrota',
    winShort: 'G',
    drawShort: 'E',
    lossShort: 'P',
  },

  pages: {
    playersEyebrow: 'Plantillas de la liga',
    playersTitle: 'Jugadores',
    clubsEyebrow: 'Clubes de la VFA',
    clubsTitle: 'Clubes',
    matchesEyebrow: 'Centro de partidos',
    matchesTitle: 'Partidos',
    competitionsEyebrow: 'Torneos de la temporada',
    competitionsTitle: 'Competiciones',
    highlightsEyebrow: 'Lo mejor de la temporada',
    highlightsTitle: 'Destacados',
    newsEyebrow: 'Cobertura oficial',
    newsTitle: 'Noticias',
    statsEyebrow: 'Números de la temporada',
    statsTitle: 'Estadísticas',
  },

  player: {
    live: 'En vivo',
    finished: 'Final',
    scheduled: 'Programado',
    round: 'Jornada',
    viewProfile: 'Ver perfil',
    robloxProfile: 'Ver perfil de Roblox',
  },

  footer: {
    notAffiliated:
      'No afiliado a Roblox Corporation. Datos de perfil obtenidos de la API pública de Roblox.',
    discord: 'Servidor de Discord',
    amateur: 'Competición amateur de fútbol 3v3 en Roblox.',
  },

  player_actions: {
    retry: 'Intentar de nuevo',
    backHome: 'Volver al inicio',
  },
};

export const DICTIONARIES: Record<Locale, Dictionary> = { pt, en, es };
