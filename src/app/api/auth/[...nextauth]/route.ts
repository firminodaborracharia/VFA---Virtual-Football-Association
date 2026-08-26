/**
 * Endpoints do Auth.js (Discord OAuth2).
 * Todo o fluxo — redirect, callback, sessão, logout — passa por aqui.
 */
import { handlers } from '@/auth';

export const { GET, POST } = handlers;
