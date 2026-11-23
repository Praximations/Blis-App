// The real screens, rendered as a phone renders them (not in a browser),
// walking the way a shopper goes: home, a product, the basket, the delivery
// choice. Runs once as an iPhone and once as an Android phone.

import { router, type Href } from 'expo-router';
import { act, fireEvent, renderRouter, screen, waitFor } from 'expo-router/testing-library';
import { Platform } from 'react-native';

import { FakeShop } from './fake-shop';

const shop = new FakeShop();
const wait = { timeout: 15000 };

/** Goes to a screen the way the app's own links do. */
const go = (path: string, how: 'push' | 'navigate' = 'push') =>
  act(async () => {
    router[how](path as Href);
  });

beforeAll(() => {
  globalThis.fetch = jest.fn(shop.fetch) as unknown as typeof fetch;
});

it(`walks from home to a basket with a delivery day (${Platform.OS})`, async () => {
  await renderRouter('./src/app', { initialUrl: '/' });

  // Home: the hero, and the shop's sections from its own menu.
  await waitFor(() => expect(screen.getByText('Food with a story')).toBeTruthy(), wait);
  await waitFor(() => expect(screen.getAllByText('Pantry').length).toBeGreaterThan(0), wait);
  expect(screen.getByText('Coming soon: Breads & Bakery')).toBeTruthy();

  // A fresh product: its page says how it gets to you.
  await go('/products/guernsey-raw-milk');
  await waitFor(() => expect(screen.getByText('Guernsey Raw Milk')).toBeTruthy(), wait);
  expect(screen.getByText('Local delivery or pickup')).toBeTruthy();
  expect(screen.getByText('$19.75')).toBeTruthy();

  // Four into the basket: the shop has three, and says so.
  const more = screen.getByLabelText('More: Quantity');
  for (let i = 0; i < 3; i++) await act(async () => fireEvent.press(more));
  await act(async () => fireEvent.press(screen.getByTestId('add-to-basket')));
  await waitFor(() => expect(screen.getByText('Only 3 of Guernsey Raw Milk are available.')).toBeTruthy(), wait);
  expect(shop.cart?.lines).toEqual([expect.objectContaining({ quantity: 3 })]);
  expect(shop.attribute('_source')).toBe(`Blis Farms app (${Platform.OS})`);

  // The basket: checkout is closed until a day is chosen.
  await go('/basket', 'navigate');
  await waitFor(() => expect(screen.getByText('Your basket')).toBeTruthy(), wait);
  expect(screen.getByText('3 items selected. Review your choices before checkout.')).toBeTruthy();
  expect(screen.getByText('Local delivery only')).toBeTruthy();
  const checkout = () => screen.getByTestId('checkout');
  expect(checkout().props.accessibilityState).toMatchObject({ disabled: true });

  // A ZIP code we don't deliver to, then one we do.
  const zip = screen.getByLabelText('ZIP code or city');
  await act(async () => fireEvent.changeText(zip, '10001'));
  await act(async () => fireEvent.press(screen.getByLabelText('Check this ZIP code or city')));
  await waitFor(() => expect(screen.getByText('Home delivery is not available for 10001 yet.')).toBeTruthy(), wait);
  await act(async () => fireEvent.changeText(screen.getByLabelText('ZIP code or city'), '33432'));
  await act(async () => fireEvent.press(screen.getByLabelText('Check this ZIP code or city')));
  await waitFor(() => expect(screen.getByText('To Boca Raton 33432')).toBeTruthy(), wait);
  expect(screen.getByText('Choose your delivery day to check out.')).toBeTruthy();

  // Pick the first day on offer: it is written to the cart and checkout opens.
  const days = screen.getAllByRole('radio').filter((node) => /day,/.test(String(node.props.accessibilityLabel)));
  expect(days.length).toBeGreaterThan(0);
  await act(async () => fireEvent.press(days[0]));
  await waitFor(() => expect(shop.attribute('Delivery date')).toMatch(/^\d{4}-\d{2}-\d{2}$/), wait);
  expect(shop.attribute('Delivery method')).toBe('Local delivery');
  expect(shop.attribute('Delivery ZIP')).toBe('33432');
  expect(shop.attribute('_blis_method')).toBe('DELIVERY');
  expect(shop.attribute('_source')).toBe(`Blis Farms app (${Platform.OS})`);
  await waitFor(() => expect(checkout().props.accessibilityState).toMatchObject({ disabled: false }), wait);

  // Pickup instead: Saturdays at the market.
  await act(async () => fireEvent.press(screen.getByRole('radio', { name: 'Pickup' })));
  await waitFor(() => expect(screen.getByText('Swank Farmers Market')).toBeTruthy(), wait);
  expect(screen.getByText('Choose your pickup day to check out.')).toBeTruthy();
  await waitFor(() => expect(shop.attribute('Delivery date')).toBe(''), wait);

  // Take the milk out: nothing needs a day any more.
  await act(async () => fireEvent.press(screen.getByLabelText('Remove Guernsey Raw Milk from the basket')));
  await waitFor(() => expect(screen.getByText('Your basket is empty')).toBeTruthy(), wait);
}, 90000);

it(`shows the other tabs and screens (${Platform.OS})`, async () => {
  await renderRouter('./src/app', { initialUrl: '/shop' });
  await waitFor(() => expect(screen.getByText('Our Products')).toBeTruthy(), wait);
  await waitFor(() => expect(screen.getByText('Dairy & Eggs')).toBeTruthy(), wait);

  await go('/collections/pantry');
  await waitFor(() => expect(screen.getByText('Truffle Honey')).toBeTruthy(), wait);
  expect(screen.getByText('50g or 170g')).toBeTruthy();

  await go('/products/truffle-honey');
  await waitFor(() => expect(screen.getByText('Size')).toBeTruthy(), wait);
  await act(async () => fireEvent.press(screen.getByRole('radio', { name: '170g' })));
  await waitFor(() => expect(screen.getByText('$30')).toBeTruthy(), wait);

  await go('/delivery');
  await waitFor(() => expect(screen.getByText('The week')).toBeTruthy(), wait);
  expect(screen.getByText('Saturday · Pickup')).toBeTruthy();

  await go('/account', 'navigate');
  await waitFor(() => expect(screen.getByText('Your account')).toBeTruthy(), wait);

  await go('/favourites');
  await waitFor(() => expect(screen.getByText('Nothing saved yet')).toBeTruthy(), wait);

  await go('/delete-account');
  await waitFor(() => expect(screen.getByText('Email my request')).toBeTruthy(), wait);
}, 90000);
