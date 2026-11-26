// The sign-in page comes first: nobody reaches the shop without signing in
// or creating an account. Sign-in itself (Shopify's page, in the phone's
// browser sheet) is stood in for; everything around it is the real app.

import { router, type Href } from 'expo-router';
import { act, fireEvent, renderRouter, screen, waitFor } from 'expo-router/testing-library';
import { Platform } from 'react-native';

import { FakeShop } from './fake-shop';

jest.mock('@/shopify/customer', () => ({
  ...jest.requireActual('@/shopify/customer'),
  signInAvailable: true,
  signIn: jest.fn(),
  signOut: jest.fn(async () => undefined),
  getCustomer: jest.fn(),
  getOrders: jest.fn(async () => ({ orders: [], next: null })),
}));

const shopify = jest.requireMock('@/shopify/customer') as { signIn: jest.Mock; signOut: jest.Mock; getCustomer: jest.Mock };
const shop = new FakeShop();
const wait = { timeout: 15000 };

beforeAll(() => {
  globalThis.fetch = jest.fn(shop.fetch) as unknown as typeof fetch;
});

it(`opens on the sign-in page, and on the shop once signed in (${Platform.OS})`, async () => {
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

  // A link straight to a product: the sign-in page comes first all the same.
  await renderRouter('./src/app', { initialUrl: '/products/guernsey-raw-milk' });
  await waitFor(() => expect(screen.getByText('Create your free account')).toBeTruthy(), wait);
  expect(screen.getByText('Welcome to Blis Farms')).toBeTruthy();
  expect(screen.getByText('All you need is your email. No password to remember.')).toBeTruthy();
  expect(screen.queryByText('Guernsey Raw Milk')).toBeNull();
  // Nowhere else to go.
  await act(async () => router.navigate('/shop' as Href));
  expect(screen.queryByText('Our Products')).toBeNull();
  expect(screen.getByText('Create your free account')).toBeTruthy();

  // Not an email address.
  await act(async () => fireEvent.changeText(screen.getByTestId('welcome-email'), 'dana'));
  await act(async () => fireEvent.press(screen.getByTestId('welcome-continue')));
  expect(screen.getByText('Please enter a valid email address.')).toBeTruthy();
  expect(shopify.signIn).not.toHaveBeenCalled();

  // "Already have an account?": the same page, in other words.
  await act(async () => fireEvent.press(screen.getByLabelText('Sign in')));
  expect(screen.getByText('Sign in to your account')).toBeTruthy();
  expect(screen.queryByText('Please enter a valid email address.')).toBeNull();
  await act(async () => fireEvent.press(screen.getByLabelText('Create an account')));

  // An email address: Shopify takes it from there, and the shop opens.
  await act(async () => fireEvent.changeText(screen.getByTestId('welcome-email'), ' dana@example.com '));
  await act(async () => fireEvent.press(screen.getByTestId('welcome-continue')));
  expect(shopify.signIn).toHaveBeenCalledWith('dana@example.com');
  await waitFor(() => expect(screen.getByText('Food with a story')).toBeTruthy(), wait);
  expect(screen.queryByText('Create your free account')).toBeNull();

  // Signed in, the sign-in page has nothing to offer: it sends you back.
  await act(async () => router.push('/welcome' as Href));
  await waitFor(() => expect(screen.queryByText('Create your free account')).toBeNull(), wait);
  expect(screen.getByText('Food with a story')).toBeTruthy();

  // Signing out leads back to it, with a welcome back.
  await act(async () => router.navigate('/account' as Href));
  await waitFor(() => expect(screen.getByText('dana@example.com')).toBeTruthy(), wait);
  await act(async () => fireEvent.press(screen.getByText('Sign out')));
  await waitFor(() => expect(screen.getByText('Welcome back, Dana')).toBeTruthy(), wait);
  expect(screen.getByText('Sign in to your account')).toBeTruthy();
  expect(screen.getByTestId('welcome-email').props.value).toBe('dana@example.com');
  expect(screen.queryByText('Your account')).toBeNull();
  expect(shopify.signOut).toHaveBeenCalled();
}, 90000);
