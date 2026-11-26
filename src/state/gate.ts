// Does the app open on the sign-in page? Decided here, in one place.

import { config, type SignInFirst } from '@/config';
import { signInAvailable } from '@/shopify/customer';

import { useAuth, type AuthState } from './auth';

/** loading: not known yet (the phone's saved session is being read). */
export type Gate = 'loading' | 'welcome' | 'open';

export interface GateSetup {
  mode: SignInFirst;
  /** Sign-in is set up (there is a client id). */
  canSignIn: boolean;
  /** Running from the developer's computer (Expo Go), not a build for customers. */
  dev: boolean;
}

const setup = (): GateSetup => ({ mode: config.signInFirst, canSignIn: signInAvailable, dev: __DEV__ });

export function gateFor(auth: Pick<AuthState, 'ready' | 'session' | 'guest'>, gate: GateSetup = setup()): Gate {
  if (gate.mode === 'off') return 'open';
  // No way to sign in: customers are never locked out. (While developing the
  // page still shows, so it can be seen before sign-in is set up.)
  if (!gate.canSignIn && !gate.dev) return 'open';
  if (!auth.ready) return 'loading';
  return auth.session || auth.guest ? 'open' : 'welcome';
}

/**
 * May someone come in without signing in?
 *   'choice'       yes, it is offered to everyone ("Look around first");
 *   'development'  only as a way in while developing: sign-in can't finish
 *                  in Expo Go, or isn't set up yet;
 *   false          no.
 */
export function skipFor(gate: GateSetup = setup()): 'choice' | 'development' | false {
  if (gate.mode !== 'required') return 'choice';
  if (!gate.canSignIn || gate.dev) return 'development';
  return false;
}

export function useGate(): Gate {
  const auth = useAuth();
  return gateFor(auth);
}
