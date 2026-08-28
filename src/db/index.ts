/**
 * Conexão com o PostgreSQL.
 *
 * O cliente é criado de forma preguiçosa: `postgres()` não abre conexão até a
 * primeira query, então importar este módulo durante o `next build` não exige
 * um banco no ar. A validação de ambiente fica em `src/env.ts` e é executada
 * por `npm run check:env` e pelas rotas que realmente precisam.
 *
 * `prepare: false` é obrigatório para pools em modo transaction — é o caso do
 * pgBouncer do Supabase e do pooler do Neon.
 */

import { drizzle } from 'drizzle-orm/postgres-js';
import postgres from 'postgres';

import * as schema from './schema';

declare global {
  var __vfaPostgres: ReturnType<typeof postgres> | undefined;
}

/**
 * Acima disto, a consulta vira um aviso no terminal em desenvolvimento.
 *
 * A checagem de `Number.isFinite` não é preciosismo: `Number('')` é 0, então
 * uma variável declarada e vazia — situação corriqueira em painel de deploy —
 * faria TODA consulta ser tratada como lenta e encher o log.
 */
const SLOW_QUERY_MS = positiveNumber(process.env.DB_SLOW_QUERY_MS, 1_500);

function positiveNumber(raw: string | undefined, fallback: number): number {
  const parsed = Number(raw?.trim());
  return Number.isFinite(parsed) && parsed > 0 ? parsed : fallback;
}

function createClient() {
  const url = process.env.DATABASE_URL;

  if (!url) {
    // Placeholder: a conexão só falha se alguém tentar consultar de verdade,
    // e aí a mensagem abaixo aponta o problema real.
    console.warn(
      '[VFA] DATABASE_URL não definida. Copie .env.example para .env.local antes de rodar o app.',
    );
  }

  const isProd = process.env.NODE_ENV === 'production';

  return postgres(url ?? 'postgresql://vfa:vfa@127.0.0.1:5432/vfa', {
    /**
     * O pool antigo era 3 em desenvolvimento. Cada página dispara dezenas de
     * consultas — várias em paralelo dentro de um `Promise.all` — e com 3
     * conexões contra um banco remoto elas viram fila. O `next dev` ainda
     * renderiza layout e página ao mesmo tempo, dobrando a demanda. O pooler
     * do Supabase aguenta muito mais que isso; segurar em 3 só criava espera
     * artificial que parecia travamento.
     */
    max: isProd ? 10 : 8,
    idle_timeout: 20,

    /**
     * 8 segundos, não 15: se o banco não responde ao handshake nesse tempo,
     * insistir não resolve. Falhar rápido com mensagem clara é melhor do que
     * uma aba girando sem explicação.
     */
    connect_timeout: 8,

    prepare: false,

    /**
     * `application_name` aparece em `pg_stat_activity` — útil para ver, do
     * lado do Supabase, quantas conexões o site realmente mantém abertas.
     *
     * Nota deliberada: NÃO enviamos `statement_timeout` aqui. Poolers em modo
     * transaction (pgBouncer) recusam a conexão inteira ao receber parâmetros
     * de startup que não conhecem. O teto por consulta fica no `withTimeout`
     * abaixo, que é client-side e funciona com qualquer pooler.
     */
    connection: { application_name: 'vfa-web' },

    /**
     * Em desenvolvimento, consultas lentas aparecem no terminal junto do SQL.
     * É a diferença entre "o site está lento" e "esta consulta leva 4s".
     */
    debug: isProd ? undefined : (_connection, query) => trackQuery(query),
  });
}

/* O `debug` do postgres.js dispara no ENVIO da consulta. Guardamos o instante
   e comparamos na próxima passagem da mesma consulta — barato, e suficiente
   para identificar o gargalo sem instrumentar cada chamada. */
const pendingQueries = new Map<string, number>();

function trackQuery(query: string) {
  const now = Date.now();
  const started = pendingQueries.get(query);

  if (started !== undefined) {
    pendingQueries.delete(query);
    const elapsed = now - started;
    if (elapsed >= SLOW_QUERY_MS) {
      console.warn(`[VFA] Consulta lenta (${elapsed}ms): ${compactSql(query)}`);
    }
    return;
  }

  pendingQueries.set(query, now);
  if (pendingQueries.size > 200) pendingQueries.clear();
}

function compactSql(sql: string): string {
  const single = sql.replace(/\s+/g, ' ').trim();
  return single.length > 160 ? `${single.slice(0, 160)}…` : single;
}

/**
 * Teto de tempo para qualquer promessa que dependa de rede.
 *
 * Regra do projeto: nada que o layout raiz espera pode pendurar para sempre.
 * Se o banco não responder no prazo, a página renderiza com o valor de
 * fallback e o motivo vai para o terminal — o visitante vê o site, não um
 * carregamento infinito.
 */
export async function withTimeout<T>(
  promise: Promise<T>,
  fallback: T,
  { ms = 10_000, label = 'consulta' }: { ms?: number; label?: string } = {},
): Promise<T> {
  let timer: ReturnType<typeof setTimeout> | undefined;

  const expired = new Promise<typeof TIMEOUT>((resolve) => {
    timer = setTimeout(() => resolve(TIMEOUT), ms);
  });

  try {
    const result = await Promise.race([promise, expired]);
    if (result === TIMEOUT) {
      console.error(
        `[VFA] ${label} passou de ${ms}ms e foi abandonada. ` +
          'A página seguiu com o valor padrão. Rode "npm run bench" para medir o banco.',
      );
      return fallback;
    }
    return result as T;
  } finally {
    if (timer) clearTimeout(timer);
  }
}

const TIMEOUT = Symbol('vfa-timeout');

const client = globalThis.__vfaPostgres ?? createClient();

if (process.env.NODE_ENV !== 'production') {
  globalThis.__vfaPostgres = client;
}

// Todas as colunas têm nome explícito no schema, então não há inferência de
// casing envolvida — o SQL gerado é igual aqui e no drizzle-kit.
export const db = drizzle(client, { schema });

export { schema };
export type Database = typeof db;
