// Sign-in first, but as a choice (EXPO_PUBLIC_SIGN_IN_FIRST=optional): the
// page has "Look around first", Account leads back to it, and signing out
// leaves you in the shop.

import { router, type Href } from 'expo-router';
import { act, fireEvent, renderRouter, screen, waitFor } from 'expo-router/testing-library';
import { Platform } from 'react-native';

import { FakeShop } from './fake-shop';

jest.mock('@/config', () => {
  const actual = jest.requireActual('@/config');
  return { ...actual, config: { ...actual.config, signInFirst: 'optional' } };
});
jest.mock('@/shopify/customer', () => ({
  ...jest.requireActual('@/shopify/customer'),
  signInAvailable: true,
  signIn: jest.fn(),
  signOut: jest.fn(async () => undefined),
  getCustomer: jest.fn(),
  getOrders: jest.fn(async () => ({ orders: [], next: null })),
}));

const shopify = jest.requireMock('@/shopify/customer') as { signIn: jest.Mock; getCustomer: jest.Mock };
const shop = new FakeShop();
const wait = { timeout: 15000 };

beforeAll(() => {
  globalThis.fetch = jest.fn(shop.fetch) as unknown as typeof fetch;
});

it(`lets you look around first, and sign in later from Account (${Platform.OS})`, async () => {
  shopify.signIn.mockResolvedValue({ accessToken: 'access', refreshToken: 'refresh', idToken: 'id', expiresAt: Date.now() + 3600_000 });
  shopify.getCustomer.mockResolvedValue({
    id: 'gid://shopify/Customer/1',
    firstName: 'Dana',
    lastName: 'Shopper',
    displayName: 'Dana Shopper',
    emailAddress: { emailAddress: 'dana@example.com' },
    phoneNumber: null,
    defaultAddress: null,
  });

  // The page still comes first, with a way past it.
  await renderRouter('./src/app', { initialUrl: '/' });
  await waitFor(() => expect(screen.getByText('Create your free account')).toBeTruthy(), wait);
  expect(screen.queryByLabelText('Close')).toBeNull();
  await act(async () => fireEvent.press(screen.getByText('Look around first')));
  await waitFor(() => expect(screen.getByText('Food with a story')).toBeTruthy(), wait);
  expect(screen.queryByText('Create your free account')).toBeNull();

  // Account leads back to it: now a page that can be closed, with nothing to skip.
  await act(async () => router.navigate('/account' as Href));
  await waitFor(() => expect(screen.getByTestId('sign-in')).toBeTruthy(), wait);
  await act(async () => fireEvent.press(screen.getByTestId('sign-in')));
  await waitFor(() => expect(screen.getByText('Create your free account')).toBeTruthy(), wait);
  expect(screen.queryByTestId('welcome-skip')).toBeNull();
  await act(async () => fireEvent.press(screen.getByLabelText('Close')));
  await waitFor(() => expect(screen.queryByText('Create your free account')).toBeNull(), wait);
  expect(screen.getByTestId('sign-in')).toBeTruthy();

  // Signing in from there comes back to Account, not to Home.
  await act(async () => fireEvent.press(screen.getByTestId('sign-in')));
  await waitFor(() => expect(screen.getByTestId('welcome-email')).toBeTruthy(), wait);
  await act(async () => fireEvent.changeText(screen.getByTestId('welcome-email'), 'dana@example.com'));
  await act(async () => fireEvent.press(screen.getByTestId('welcome-continue')));
  await waitFor(() => expect(screen.getByText('dana@example.com')).toBeTruthy(), wait);
  expect(screen.getByText(/^Good (morning|afternoon|evening), Dana$/)).toBeTruthy();
  expect(screen.queryByText('Create your free account')).toBeNull();

  // Signing out leaves you in the shop.
  await act(async () => fireEvent.press(screen.getByText('Sign out')));
  await waitFor(() => expect(screen.getByTestId('sign-in')).toBeTruthy(), wait);
  expect(screen.getByText('Your account')).toBeTruthy();
  expect(screen.queryByText('Sign in to your account')).toBeNull();
}, 90000);
