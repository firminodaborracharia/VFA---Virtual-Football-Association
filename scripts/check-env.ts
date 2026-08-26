/**
 * Verifica se o ambiente está pronto antes de rodar o projeto.
 * Testa também a conexão real com o banco, em vez de só checar se a variável existe.
 */

import './load-env';
import postgres from 'postgres';

type Check = { name: string; ok: boolean; detail: string };

async function main() {
  const checks: Check[] = [];

  const url = process.env.DATABASE_URL;
  checks.push({
    name: 'DATABASE_URL',
    ok: Boolean(url),
    detail: url ? 'definida' : 'faltando — copie .env.example para .env.local',
  });

  const secret = process.env.AUTH_SECRET;
  checks.push({
    name: 'AUTH_SECRET',
    ok: Boolean(secret && secret.length >= 16),
    detail: secret ? 'definida' : 'faltando — gere com: npx auth secret',
  });

  const discordId = process.env.AUTH_DISCORD_ID;
  const discordSecret = process.env.AUTH_DISCORD_SECRET;
  checks.push({
    name: 'Discord OAuth2',
    ok: Boolean(discordId && discordSecret),
    detail:
      discordId && discordSecret
        ? 'configurado'
        : 'faltando AUTH_DISCORD_ID / AUTH_DISCORD_SECRET — sem isso o login não funciona',
  });

  const admins = process.env.BOOTSTRAP_ADMIN_DISCORD_IDS;
  checks.push({
    name: 'Primeiro administrador',
    ok: Boolean(admins?.trim()),
    detail: admins?.trim()
      ? `${admins.split(',').filter(Boolean).length} ID(s) configurado(s)`
      : 'BOOTSTRAP_ADMIN_DISCORD_IDS vazio — ninguém vira admin automaticamente',
  });

  if (url) {
    const client = postgres(url, { max: 1, prepare: false, connect_timeout: 10 });
    try {
      await client`select 1`;
      checks.push({ name: 'Conexão com o banco', ok: true, detail: 'respondeu' });
    } catch (error) {
      checks.push({
        name: 'Conexão com o banco',
        ok: false,
        detail: error instanceof Error ? error.message : 'falhou',
      });
    } finally {
      await client.end();
    }
  }

  console.log('\nVerificação do ambiente VFA\n');
  for (const check of checks) {
    console.log(`  ${check.ok ? '✓' : '✗'} ${check.name.padEnd(24)} ${check.detail}`);
  }

  const failed = checks.filter((check) => !check.ok);
  console.log(
    failed.length === 0
      ? '\nTudo pronto. Rode: npm run db:migrate && npm run db:seed && npm run dev\n'
      : `\n${failed.length} item(ns) pendente(s). Veja o README.md.\n`,
  );

  process.exitCode = failed.length > 0 ? 1 : 0;
}

void main();
