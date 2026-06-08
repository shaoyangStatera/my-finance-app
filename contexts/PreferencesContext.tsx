import { createContext, ReactNode, useCallback, useContext, useEffect, useMemo, useState } from 'react';
import { Platform } from 'react-native';
import * as SecureStore from 'expo-secure-store';
import type { NotificationPrefs } from '@/lib/types';
import { DEFAULT_NOTIF_PREFS } from '@/lib/types';

const PREFS_KEY = 'nestworth_prefs';

export interface Preferences {
  avatarEmoji: string;
  darkMode: boolean;
  notifPrefs: NotificationPrefs;
}

const DEFAULTS: Preferences = {
  avatarEmoji: '🏡',
  darkMode: false,
  notifPrefs: DEFAULT_NOTIF_PREFS,
};

interface PreferencesContextValue {
  prefs: Preferences;
  setAvatarEmoji: (emoji: string) => void;
  setDarkMode: (dark: boolean) => void;
  setNotifPrefs: (prefs: NotificationPrefs) => void;
}

const PreferencesContext = createContext<PreferencesContextValue | null>(null);

function migratePrefs(raw: Record<string, unknown>): Preferences {
  const base: Preferences = { ...DEFAULTS };
  if (typeof raw.avatarEmoji === 'string') base.avatarEmoji = raw.avatarEmoji;
  if (typeof raw.darkMode === 'boolean') base.darkMode = raw.darkMode;
  if (raw.notifPrefs && typeof raw.notifPrefs === 'object') {
    base.notifPrefs = { ...DEFAULT_NOTIF_PREFS, ...(raw.notifPrefs as Partial<NotificationPrefs>) };
  }
  // Migrate legacy bgColor → darkMode
  if (!('darkMode' in raw) && typeof raw.bgColor === 'string') {
    base.darkMode = ['#1A1A2E', '#1C2B24'].includes(raw.bgColor);
  }
  return base;
}

async function loadPrefs(): Promise<Preferences> {
  try {
    const raw = Platform.OS === 'web'
      ? localStorage.getItem(PREFS_KEY)
      : await SecureStore.getItemAsync(PREFS_KEY);
    if (raw) return migratePrefs(JSON.parse(raw));
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

  const setDarkMode = useCallback((dark: boolean) => {
    setPrefs((p) => {
      const next = { ...p, darkMode: dark };
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
    () => ({ prefs, setAvatarEmoji, setDarkMode, setNotifPrefs }),
    [prefs, setAvatarEmoji, setDarkMode, setNotifPrefs],
  );

  return <PreferencesContext.Provider value={value}>{children}</PreferencesContext.Provider>;
}

export function usePreferences() {
  const ctx = useContext(PreferencesContext);
  if (!ctx) throw new Error('usePreferences must be used within PreferencesProvider');
  return ctx;
}
