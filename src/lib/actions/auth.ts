'use server';

import { signIn, signOut } from '@/auth';

/** Inicia o fluxo OAuth2 do Discord. */
export async function signInWithDiscord(redirectTo = '/') {
  await signIn('discord', { redirectTo });
}

export async function signOutAction() {
  await signOut({ redirectTo: '/' });
}
