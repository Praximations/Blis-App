import { signInFirstFrom } from '@/config';
import { gateFor, skipFor, type GateSetup } from '@/state/gate';

const session = { accessToken: 'a', refreshToken: null, idToken: null, expiresAt: 0 };
const nobody = { ready: true, session: null, guest: false };
// A build for customers, with sign-in set up.
const shipped: GateSetup = { mode: 'required', canSignIn: true, dev: false };

describe('the setting (EXPO_PUBLIC_SIGN_IN_FIRST)', () => {
  it('is required on phones unless it says otherwise', () => {
    expect(signInFirstFrom(undefined, false)).toBe('required');
    expect(signInFirstFrom('', false)).toBe('required');
    expect(signInFirstFrom(' Optional ', false)).toBe('optional');
    expect(signInFirstFrom('off', false)).toBe('off');
    expect(signInFirstFrom('nonsense', false)).toBe('required');
  });

  it('leaves a way in on the web link, unless told to lock that too', () => {
    expect(signInFirstFrom(undefined, true)).toBe('optional');
    expect(signInFirstFrom('required', true)).toBe('required');
    expect(signInFirstFrom('off', true)).toBe('off');
  });
});

describe('does the app open on the sign-in page?', () => {
  it('yes, for anyone not signed in, when sign-in is required', () => {
    expect(gateFor(nobody, shipped)).toBe('welcome');
    expect(gateFor({ ...nobody, session }, shipped)).toBe('open');
    expect(skipFor(shipped)).toBe(false);
  });

  it('waits until the saved session has been read, rather than flash the page at someone signed in', () => {
    expect(gateFor({ ready: false, session: null, guest: false }, shipped)).toBe('loading');
  });

  it('offers a way round when sign-in is optional', () => {
    const optional: GateSetup = { ...shipped, mode: 'optional' };
    expect(gateFor(nobody, optional)).toBe('welcome');
    expect(skipFor(optional)).toBe('choice');
    expect(gateFor({ ...nobody, guest: true }, optional)).toBe('open');
  });

  it('never, when it is turned off', () => {
    expect(gateFor({ ready: false, session: null, guest: false }, { ...shipped, mode: 'off' })).toBe('open');
  });

  it('never locks customers out of a shop they have no way to sign in to', () => {
    expect(gateFor(nobody, { mode: 'required', canSignIn: false, dev: false })).toBe('open');
  });

  it('still shows while developing, with a way in', () => {
    // Before sign-in is set up, so the page can be seen…
    const notSetUp: GateSetup = { mode: 'required', canSignIn: false, dev: true };
    expect(gateFor(nobody, notSetUp)).toBe('welcome');
    expect(skipFor(notSetUp)).toBe('development');
    // …and in Expo Go, where sign-in can't finish.
    expect(skipFor({ mode: 'required', canSignIn: true, dev: true })).toBe('development');
    expect(gateFor({ ...nobody, guest: true }, notSetUp)).toBe('open');
  });
});
