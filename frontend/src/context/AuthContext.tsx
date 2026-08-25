/**
 * AuthContext — handles three states: loading | authenticated | unauthenticated.
 *
 * Supports both auth flows:
 *   1. Email/password (POST /api/auth/login, /api/auth/register)
 *   2. Emergent Google Auth (redirect + POST /api/auth/session with session_id)
 */
import React, { createContext, useCallback, useContext, useEffect, useRef, useState } from 'react';
import { Platform } from 'react-native';
import * as WebBrowser from 'expo-web-browser';
import * as Linking from 'expo-linking';
import { post, get, clearToken, saveToken, loadToken } from '../api/client';

WebBrowser.maybeCompleteAuthSession();

export type User = {
  user_id: string;
  email?: string;
  name?: string;
  role: 'influencer' | 'business' | 'admin' | 'pending';
  avatar_url?: string;
  category?: string;
  region?: string;
  followers?: number;
  engagement_rate?: number;
  pricing?: Record<string, number>;
  platforms?: string[];
  social_handles?: Record<string, string>;
  bio?: string;
  brand_name?: string;
  industry?: string;
  website?: string;
  phone?: string;
  unlock_tier?: 'basic' | 'silver' | 'gold';
  verified?: boolean;
  rating_avg?: number;
  rating_count?: number;
  provider?: string;
};

type AuthState = {
  user: User | null;
  loading: boolean;
  loginEmail: (email: string, password: string) => Promise<void>;
  registerEmail: (email: string, password: string, name: string, role: 'influencer' | 'business') => Promise<void>;
  loginGoogle: () => Promise<void>;
  selectRole: (role: 'influencer' | 'business') => Promise<void>;
  refresh: () => Promise<void>;
  logout: () => Promise<void>;
  updateUser: (u: User) => void;
};

const AuthCtx = createContext<AuthState | null>(null);

export function AuthProvider({ children }: { children: React.ReactNode }) {
  const [user, setUser] = useState<User | null>(null);
  const [loading, setLoading] = useState(true);
  const processedSessionIds = useRef<Set<string>>(new Set());

  const refresh = useCallback(async () => {
    try {
      const token = await loadToken();
      if (!token) {
        setUser(null);
        return;
      }
      const { user } = await get<{ user: User }>('/api/auth/me');
      setUser(user);
    } catch {
      await clearToken();
      setUser(null);
    }
  }, []);

  // Handle the Emergent Google callback session_id.
  const consumeSessionId = useCallback(async (rawUrl: string | null | undefined) => {
    if (!rawUrl) return false;
    const m = /[?#&]session_id=([^&#]+)/.exec(rawUrl);
    if (!m) return false;
    const sid = decodeURIComponent(m[1]);
    if (processedSessionIds.current.has(sid)) return true;
    processedSessionIds.current.add(sid);
    try {
      const { session_token, user } = await post<{ session_token: string; user: User }>(
        '/api/auth/session',
        { session_id: sid },
      );
      await saveToken(session_token);
      setUser(user);
      return true;
    } catch (e) {
      console.warn('session exchange failed', e);
      return false;
    }
  }, []);

  useEffect(() => {
    (async () => {
      // Process cold-start deep link first, then fall back to existing session.
      if (Platform.OS !== 'web') {
        const initial = await Linking.getInitialURL();
        const consumed = await consumeSessionId(initial);
        if (!consumed) await refresh();
      } else {
        if (typeof window !== 'undefined') {
          const src = window.location.hash + '&' + window.location.search;
          const consumed = await consumeSessionId(src);
          if (consumed && typeof window !== 'undefined') {
            // Clean session_id from URL, keep everything else.
            const clean = window.location.href.replace(/[?#&]session_id=[^&#]+/, '');
            window.history.replaceState(window.history.state, '', clean);
          }
          if (!consumed) await refresh();
        }
      }
      setLoading(false);
    })();

    // Warm deep links after mount.
    const sub = Linking.addEventListener('url', ({ url }) => {
      void consumeSessionId(url);
    });
    return () => sub.remove();
  }, [consumeSessionId, refresh]);

  const loginEmail = useCallback(async (email: string, password: string) => {
    const { session_token, user } = await post<{ session_token: string; user: User }>(
      '/api/auth/login',
      { email, password },
    );
    await saveToken(session_token);
    setUser(user);
  }, []);

  const registerEmail = useCallback(
    async (email: string, password: string, name: string, role: 'influencer' | 'business') => {
      const { session_token, user } = await post<{ session_token: string; user: User }>(
        '/api/auth/register',
        { email, password, name, role },
      );
      await saveToken(session_token);
      setUser(user);
    },
    [],
  );

  const loginGoogle = useCallback(async () => {
    // On web, direct navigation. On mobile, ASWebAuthenticationSession / Custom Tabs.
    if (Platform.OS === 'web') {
      const redirect = window.location.origin + '/';
      window.location.href = `https://auth.emergentagent.com/?redirect=${encodeURIComponent(redirect)}`;
      return;
    }
    const redirect = Linking.createURL('');
    const authUrl = `https://auth.emergentagent.com/?redirect=${encodeURIComponent(redirect)}`;
    const result = await WebBrowser.openAuthSessionAsync(authUrl, redirect);
    // Try result.url first; the url listener + getInitialURL cover Android quirks.
    if (result.type === 'success' && result.url) {
      await consumeSessionId(result.url);
    } else {
      const initial = await Linking.getInitialURL();
      await consumeSessionId(initial);
    }
  }, [consumeSessionId]);

  const selectRole = useCallback(async (role: 'influencer' | 'business') => {
    await post('/api/auth/select-role', { role });
    await refresh();
  }, [refresh]);

  const logout = useCallback(async () => {
    try { await post('/api/auth/logout'); } catch {}
    await clearToken();
    setUser(null);
  }, []);

  const updateUser = useCallback((u: User) => setUser(u), []);

  return (
    <AuthCtx.Provider
      value={{ user, loading, loginEmail, registerEmail, loginGoogle, selectRole, refresh, logout, updateUser }}
    >
      {children}
    </AuthCtx.Provider>
  );
}

export function useAuth() {
  const ctx = useContext(AuthCtx);
  if (!ctx) throw new Error('useAuth must be used inside AuthProvider');
  return ctx;
}
