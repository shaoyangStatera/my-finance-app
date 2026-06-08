import { createContext, ReactNode, useCallback, useContext, useEffect, useMemo, useState } from 'react';
import { Platform } from 'react-native';
import * as SecureStore from 'expo-secure-store';
import type { NotificationPrefs } from '@/lib/types';
import { DEFAULT_NOTIF_PREFS } from '@/lib/types';

const PREFS_KEY = 'nestworth_prefs';

export interface Preferences {
  avatarEmoji: string;
  bgColor: string;
  notifPrefs: NotificationPrefs;
}

const DEFAULTS: Preferences = {
  avatarEmoji: '🏡',
  bgColor: '#F5F4F0',
  notifPrefs: DEFAULT_NOTIF_PREFS,
};

interface PreferencesContextValue {
  prefs: Preferences;
  setAvatarEmoji: (emoji: string) => void;
  setBgColor: (color: string) => void;
  setNotifPrefs: (prefs: NotificationPrefs) => void;
}

const PreferencesContext = createContext<PreferencesContextValue | null>(null);

async function loadPrefs(): Promise<Preferences> {
  try {
    const raw = Platform.OS === 'web'
      ? localStorage.getItem(PREFS_KEY)
      : await SecureStore.getItemAsync(PREFS_KEY);
    if (raw) return { ...DEFAULTS, ...JSON.parse(raw) };
  } catch {}
  return DEFAULTS;
}

async function savePrefs(prefs: Preferences): Promise<void> {
  try {
    const raw = JSON.stringify(prefs);
    if (Platform.OS === 'web') {
      localStorage.setItem(PREFS_KEY, raw);
    } else {
      await SecureStore.setItemAsync(PREFS_KEY, raw);
    }
  } catch {}
}

export function PreferencesProvider({ children }: { children: ReactNode }) {
  const [prefs, setPrefs] = useState<Preferences>(DEFAULTS);

  useEffect(() => {
    loadPrefs().then(setPrefs);
  }, []);

  const setAvatarEmoji = useCallback((emoji: string) => {
    setPrefs((p) => {
      const next = { ...p, avatarEmoji: emoji };
      savePrefs(next);
      return next;
    });
  }, []);

  const setBgColor = useCallback((color: string) => {
    setPrefs((p) => {
      const next = { ...p, bgColor: color };
      savePrefs(next);
      return next;
    });
  }, []);

  const setNotifPrefs = useCallback((notifPrefs: NotificationPrefs) => {
    setPrefs((p) => {
      const next = { ...p, notifPrefs };
      savePrefs(next);
      return next;
    });
  }, []);

  const value = useMemo(
    () => ({ prefs, setAvatarEmoji, setBgColor, setNotifPrefs }),
    [prefs, setAvatarEmoji, setBgColor, setNotifPrefs],
  );

  return <PreferencesContext.Provider value={value}>{children}</PreferencesContext.Provider>;
}

export function usePreferences() {
  const ctx = useContext(PreferencesContext);
  if (!ctx) throw new Error('usePreferences must be used within PreferencesProvider');
  return ctx;
}
