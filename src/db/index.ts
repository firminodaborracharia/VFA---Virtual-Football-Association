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

function createClient() {
  const url = process.env.DATABASE_URL;

  if (!url) {
    // Placeholder: a conexão só falha se alguém tentar consultar de verdade,
    // e aí a mensagem abaixo aponta o problema real.
    console.warn(
      '[VFA] DATABASE_URL não definida. Copie .env.example para .env.local antes de rodar o app.',
    );
  }

  return postgres(url ?? 'postgresql://vfa:vfa@127.0.0.1:5432/vfa', {
    max: process.env.NODE_ENV === 'production' ? 10 : 3,
    idle_timeout: 20,
    connect_timeout: 15,
    prepare: false,
  });
}

const client = globalThis.__vfaPostgres ?? createClient();

if (process.env.NODE_ENV !== 'production') {
  globalThis.__vfaPostgres = client;
}

// Todas as colunas têm nome explícito no schema, então não há inferência de
// casing envolvida — o SQL gerado é igual aqui e no drizzle-kit.
export const db = drizzle(client, { schema });

export { schema };
export type Database = typeof db;
