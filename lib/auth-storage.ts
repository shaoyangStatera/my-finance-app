import { Platform, AppState, type AppStateStatus } from 'react-native';
import * as SecureStore from 'expo-secure-store';

const TOKEN_KEY = 'nestworth_auth_token';
const USER_KEY = 'nestworth_auth_user';
const EXPIRES_KEY = 'nestworth_auth_expires';

async function setItem(key: string, value: string): Promise<void> {
  if (Platform.OS === 'web') {
    localStorage.setItem(key, value);
    return;
  }
  await SecureStore.setItemAsync(key, value);
}

async function getItem(key: string): Promise<string | null> {
  if (Platform.OS === 'web') {
    return localStorage.getItem(key);
  }
  return SecureStore.getItemAsync(key);
}

async function deleteItem(key: string): Promise<void> {
  if (Platform.OS === 'web') {
    localStorage.removeItem(key);
    return;
  }
  await SecureStore.deleteItemAsync(key);
}

export function decodeTokenExpiry(token: string): number | null {
  try {
    const payload = JSON.parse(atob(token.split('.')[1]));
    return typeof payload.exp === 'number' ? payload.exp * 1000 : null;
  } catch {
    return null;
  }
}

export async function saveAuth(token: string, userJson: string): Promise<void> {
  const expiresAt = decodeTokenExpiry(token);
  await setItem(TOKEN_KEY, token);
  await setItem(USER_KEY, userJson);
  if (expiresAt) {
    await setItem(EXPIRES_KEY, String(expiresAt));
  }
}

export async function getToken(): Promise<string | null> {
  const token = await getItem(TOKEN_KEY);
  if (!token) return null;

  const expiresAt = await getItem(EXPIRES_KEY);
  if (expiresAt && Date.now() > Number(expiresAt)) {
    await clearAuth();
    return null;
  }

  const decodedExpiry = decodeTokenExpiry(token);
  if (decodedExpiry && Date.now() > decodedExpiry) {
    await clearAuth();
    return null;
  }

  return token;
}

export async function getStoredUser(): Promise<string | null> {
  return getItem(USER_KEY);
}

export async function clearAuth(): Promise<void> {
  await deleteItem(TOKEN_KEY);
  await deleteItem(USER_KEY);
  await deleteItem(EXPIRES_KEY);
}

export async function touchSession(): Promise<void> {
  await setItem('nestworth_last_activity', String(Date.now()));
}

export async function getLastActivity(): Promise<number> {
  const value = await getItem('nestworth_last_activity');
  return value ? Number(value) : Date.now();
}

export async function isSessionInactive(inactivityMs: number): Promise<boolean> {
  const last = await getLastActivity();
  return Date.now() - last > inactivityMs;
}

export function subscribeToAppState(onChange: (state: AppStateStatus) => void) {
  return AppState.addEventListener('change', onChange);
}
