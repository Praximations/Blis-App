// The app's stores, made once.

import { AuthStore } from './auth';
import { CartStore } from './cart';
import { DeliveryStore } from './delivery';
import { ShelfStore } from './shelf';

export const cartStore = new CartStore();
export const deliveryStore = new DeliveryStore(cartStore);
export const authStore = new AuthStore(cartStore);
export const shelfStore = new ShelfStore();
