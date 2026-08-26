/**
 * Aplica as migrations SQL da pasta drizzle/ no banco apontado por DATABASE_URL.
 * Usa uma conexão direta (não pooled) e a encerra ao final.
 */

import './load-env';
import { drizzle } from 'drizzle-orm/postgres-js';
import { migrate } from 'drizzle-orm/postgres-js/migrator';
import postgres from 'postgres';

async function main() {
  const url = process.env.DATABASE_URL;

  if (!url) {
    console.error('\n✗ DATABASE_URL não definida. Copie .env.example para .env.local.\n');
    process.exit(1);
  }

  console.log('→ Aplicando migrations…');

  const client = postgres(url, { max: 1, prepare: false });

  try {
    await migrate(drizzle(client), { migrationsFolder: './drizzle' });
    console.log('✓ Banco atualizado.\n');
  } catch (error) {
    console.error('\n✗ Falha ao aplicar as migrations:\n', error, '\n');
    process.exitCode = 1;
  } finally {
    await client.end();
  }
}

void main();
