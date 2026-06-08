import { createContext, ReactNode, useCallback, useContext, useEffect, useMemo, useState } from 'react';
import { AppState, Platform } from 'react-native';
import {
  ApiError,
  login as apiLogin,
  register as apiRegister,
  resetPassword as apiResetPassword,
  verifyEmail as apiVerifyEmail,
  verifyOtp as apiVerifyOtp,
} from '@/lib/api';
import {
  clearAuth,
  getStoredUser,
  getToken,
  isSessionInactive,
  saveAuth,
  subscribeToAppState,
  touchSession,
} from '@/lib/auth-storage';
import { SESSION_INACTIVITY_MS } from '@/lib/session-config';
import type { LoginStepOneResponse, RegisterResponse, User } from '@/lib/types';

export type LoginResult =
  | { loggedIn: true }
  | { requiresPasswordReset: true; pendingToken: string; message: string };

interface AuthContextValue {
  user: User | null;
  isLoading: boolean;
  isAuthenticated: boolean;
  isGuest: boolean;
  register: (email: string, password: string, displayName: string) => Promise<RegisterResponse>;
  verifyEmail: (pendingToken: string, code: string) => Promise<void>;
  login: (email: string, password: string) => Promise<LoginResult>;
  verifyOtp: (pendingToken: string, code: string) => Promise<void>;
  resetPassword: (pendingToken: string, code: string, newPassword: string) => Promise<void>;
  continueAsGuest: () => void;
  logout: () => Promise<void>;
  touchActivity: () => void;
  updateUser: (user: User, token: string) => void;
}

const AuthContext = createContext<AuthContextValue | null>(null);
const ACTIVITY_CHECK_INTERVAL_MS = 60 * 1000;

const GUEST_USER: User = {
  _id: 'guest',
  email: '',
  displayName: 'Guest',
  onboardingComplete: true,
};

export function AuthProvider({ children }: { children: ReactNode }) {
  const [user, setUser] = useState<User | null>(null);
  const [isGuest, setIsGuest] = useState(false);
  const [isLoading, setIsLoading] = useState(true);

  const logout = useCallback(async () => {
    await clearAuth();
    setUser(null);
    setIsGuest(false);
  }, []);

  const continueAsGuest = useCallback(() => {
    setUser(GUEST_USER);
    setIsGuest(true);
  }, []);

  const touchActivity = useCallback(() => {
    if (user) touchSession();
  }, [user]);

  useEffect(() => {
    async function restoreSession() {
      try {
        const inactive = await isSessionInactive(SESSION_INACTIVITY_MS);
        if (inactive) { await clearAuth(); return; }
        const token = await getToken();
        const storedUser = await getStoredUser();
        if (token && storedUser) {
          setUser(JSON.parse(storedUser));
          await touchSession();
        }
      } finally {
        setIsLoading(false);
      }
    }
    restoreSession();
  }, []);

  useEffect(() => {
    if (!user) return;
    async function checkInactivity() {
      const inactive = await isSessionInactive(SESSION_INACTIVITY_MS);
      if (inactive) await logout();
    }
    const interval = setInterval(checkInactivity, ACTIVITY_CHECK_INTERVAL_MS);
    const appStateSub = subscribeToAppState((state) => {
      if (state === 'active') checkInactivity();
    });
    let removeWebListeners: (() => void) | undefined;
    if (Platform.OS === 'web' && typeof window !== 'undefined') {
      const onActivity = () => touchSession();
      const events = ['mousedown', 'keydown', 'scroll', 'touchstart'] as const;
      events.forEach((e) => window.addEventListener(e, onActivity, { passive: true }));
      removeWebListeners = () => events.forEach((e) => window.removeEventListener(e, onActivity));
    } else {
      const sub = AppState.addEventListener('change', (s) => { if (s === 'active') touchSession(); });
      removeWebListeners = () => sub.remove();
    }
    return () => { clearInterval(interval); appStateSub.remove(); removeWebListeners?.(); };
  }, [user, logout]);

  const register = useCallback(async (email: string, password: string, displayName: string) => {
    return apiRegister(email, password, displayName);
  }, []);

  const verifyEmail = useCallback(async (pendingToken: string, code: string) => {
    const response = await apiVerifyEmail(pendingToken, code);
    await saveAuth(response.token, JSON.stringify(response.user));
    await touchSession();
    setIsGuest(false);
    setUser(response.user);
  }, []);

  const login = useCallback(async (email: string, password: string): Promise<LoginResult> => {
    const result = await apiLogin(email, password);
    if ('token' in result && result.token) {
      // Direct login — no OTP required
      await saveAuth(result.token, JSON.stringify(result.user));
      await touchSession();
      setIsGuest(false);
      setUser(result.user as User);
      return { loggedIn: true };
    }
    // Password expired — needs OTP + reset
    return {
      requiresPasswordReset: true,
      pendingToken: (result as LoginStepOneResponse).pendingToken,
      message: (result as LoginStepOneResponse).message ?? 'Your password has expired.',
    };
  }, []);

  const verifyOtp = useCallback(async (pendingToken: string, code: string) => {
    const response = await apiVerifyOtp(pendingToken, code);
    await saveAuth(response.token, JSON.stringify(response.user));
    await touchSession();
    setIsGuest(false);
    setUser(response.user);
  }, []);

  const resetPassword = useCallback(async (pendingToken: string, code: string, newPassword: string) => {
    const response = await apiResetPassword(pendingToken, code, newPassword);
    await saveAuth(response.token, JSON.stringify(response.user));
    await touchSession();
    setIsGuest(false);
    setUser(response.user);
  }, []);

  const updateUser = useCallback((newUser: User, token: string) => {
    saveAuth(token, JSON.stringify(newUser));
    setUser(newUser);
  }, []);

  const value = useMemo(() => ({
    user,
    isLoading,
    isAuthenticated: !!user,
    isGuest,
    register,
    verifyEmail,
    login,
    verifyOtp,
    resetPassword,
    continueAsGuest,
    logout,
    touchActivity,
    updateUser,
  }), [user, isGuest, isLoading, register, verifyEmail, login, verifyOtp, resetPassword, continueAsGuest, logout, touchActivity, updateUser]);

  return <AuthContext.Provider value={value}>{children}</AuthContext.Provider>;
}

export function useAuth() {
  const ctx = useContext(AuthContext);
  if (!ctx) throw new Error('useAuth must be used within AuthProvider');
  return ctx;
}

export { ApiError };
