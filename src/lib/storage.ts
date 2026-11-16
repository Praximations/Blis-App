// What the app remembers on the phone. Ordinary things (basket id, delivery
// choice, favourites) go in AsyncStorage; the sign-in tokens go in the
// keychain (SecureStore), which the web doesn't have.

import AsyncStorage from '@react-native-async-storage/async-storage';
import * as SecureStore from 'expo-secure-store';
import { Platform } from 'react-native';

export const keys = {
  cartId: 'blis.cart.v1',
  delivery: 'blis.delivery.v1',
  favourites: 'blis.likes.v1',
  recent: 'blis.recent.v1',
  searches: 'blis.searches.v1',
  rules: 'blis.rules.v1',
  session: 'blis.session.v1',
} as const;

export async function readJSON<T>(key: string): Promise<T | null> {
  try {
    const raw = await AsyncStorage.getItem(key);
    return raw ? (JSON.parse(raw) as T) : null;
  } catch {
    return null;
  }
}

export async function writeJSON(key: string, value: unknown): Promise<void> {
  try {
    if (value == null) await AsyncStorage.removeItem(key);
    else await AsyncStorage.setItem(key, JSON.stringify(value));
  } catch {
    // Storage full or unavailable: the app works without remembering.
  }
}

const secureKey = (key: string) => key.replace(/[^A-Za-z0-9._-]/g, '_');

export async function readSecret<T>(key: string): Promise<T | null> {
  if (Platform.OS === 'web') return readJSON<T>(key);
  try {
    const raw = await SecureStore.getItemAsync(secureKey(key));
    return raw ? (JSON.parse(raw) as T) : null;
  } catch {
    return null;
  }
}

export async function writeSecret(key: string, value: unknown): Promise<void> {
  if (Platform.OS === 'web') return writeJSON(key, value);
  try {
    if (value == null) await SecureStore.deleteItemAsync(secureKey(key));
    else await SecureStore.setItemAsync(secureKey(key), JSON.stringify(value));
  } catch {
    // Keychain unavailable: the customer signs in again next time.
  }
}
