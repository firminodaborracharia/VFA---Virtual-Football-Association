/**
 * Carrega variáveis de ambiente para os scripts de linha de comando.
 *
 * O Next lê `.env.local` sozinho, mas os scripts rodados com `tsx` não — por
 * isso a ordem de precedência é reproduzida aqui: `.env.local` ganha de `.env`.
 */

import { config } from 'dotenv';

config({ path: '.env.local' });
config({ path: '.env' });
