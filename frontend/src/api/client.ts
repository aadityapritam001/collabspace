/**
 * Minimal fetch wrapper that:
 *   - Reads EXPO_PUBLIC_BACKEND_URL from env (never hardcoded)
 *   - Attaches the Bearer session_token to every call automatically
 *   - Returns parsed JSON or throws { status, detail }
 */
import { Platform } from 'react-native';
import * as SecureStore from 'expo-secure-store';

const BASE_URL = process.env.EXPO_PUBLIC_BACKEND_URL;
const TOKEN_KEY = 'collabspace_session_token';

// In-memory copy so we don't hit SecureStore on every request.
let memoryToken: string | null = null;

export async function loadToken(): Promise<string | null> {
  if (memoryToken) return memoryToken;
  try {
    if (Platform.OS === 'web') {
      memoryToken = typeof localStorage !== 'undefined' ? localStorage.getItem(TOKEN_KEY) : null;
    } else {
      memoryToken = await SecureStore.getItemAsync(TOKEN_KEY);
    }
  } catch {
    memoryToken = null;
  }
  return memoryToken;
}

export async function saveToken(token: string) {
  memoryToken = token;
  if (Platform.OS === 'web') {
    if (typeof localStorage !== 'undefined') localStorage.setItem(TOKEN_KEY, token);
  } else {
    await SecureStore.setItemAsync(TOKEN_KEY, token);
  }
}

export async function clearToken() {
  memoryToken = null;
  if (Platform.OS === 'web') {
    if (typeof localStorage !== 'undefined') localStorage.removeItem(TOKEN_KEY);
  } else {
    await SecureStore.deleteItemAsync(TOKEN_KEY);
  }
}

export function getBaseUrl(): string {
  if (!BASE_URL) throw new Error('EXPO_PUBLIC_BACKEND_URL not set');
  return BASE_URL;
}

export async function api<T = any>(
  path: string,
  opts: RequestInit = {},
): Promise<T> {
  const token = await loadToken();
  const headers: Record<string, string> = {
    'Content-Type': 'application/json',
    ...((opts.headers as Record<string, string>) || {}),
  };
  if (token) headers.Authorization = `Bearer ${token}`;
  const res = await fetch(`${getBaseUrl()}${path}`, { ...opts, headers });
  const text = await res.text();
  const data = text ? JSON.parse(text) : {};
  if (!res.ok) {
    const err: any = new Error(data?.detail || `HTTP ${res.status}`);
    err.status = res.status;
    err.detail = data?.detail;
    throw err;
  }
  return data as T;
}

// Convenience shorthands.
export const get = <T = any>(p: string) => api<T>(p);
export const post = <T = any>(p: string, body?: any) =>
  api<T>(p, { method: 'POST', body: JSON.stringify(body ?? {}) });
export const put = <T = any>(p: string, body?: any) =>
  api<T>(p, { method: 'PUT', body: JSON.stringify(body ?? {}) });
export const patch = <T = any>(p: string, body?: any) =>
  api<T>(p, { method: 'PATCH', body: JSON.stringify(body ?? {}) });
export const del = <T = any>(p: string) => api<T>(p, { method: 'DELETE' });
