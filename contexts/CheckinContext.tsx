import { createContext, ReactNode, useCallback, useContext, useEffect, useMemo, useState } from 'react';
import { fetchCheckin, saveCheckin as apiSaveCheckin } from '@/lib/api';
import { getCurrentMonthYear } from '@/lib/format';
import { createEmptyCheckin, normalizeCheckin, type MonthlyCheckin } from '@/lib/types';
import { useAuth } from './AuthContext';

interface CheckinContextValue {
  monthYear: string;
  setMonthYear: (monthYear: string) => void;
  checkin: MonthlyCheckin | null;
  isLoading: boolean;
  isSaving: boolean;
  error: string | null;
  updateCheckin: (updater: (current: MonthlyCheckin) => MonthlyCheckin) => void;
  saveCheckin: () => Promise<void>;
  reload: () => Promise<void>;
}

const CheckinContext = createContext<CheckinContextValue | null>(null);

export function CheckinProvider({ children }: { children: ReactNode }) {
  const { user, isGuest } = useAuth();
  const [monthYear, setMonthYear] = useState(getCurrentMonthYear());
  const [checkin, setCheckin] = useState<MonthlyCheckin | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [isSaving, setIsSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const loadCheckin = useCallback(async () => {
    setIsLoading(true);
    setError(null);
    // Guests get a local empty checkin — no API call
    if (isGuest) {
      setCheckin(createEmptyCheckin(monthYear, ''));
      setIsLoading(false);
      return;
    }
    try {
      const data = await fetchCheckin(monthYear);
      setCheckin(normalizeCheckin(data));
    } catch {
      setCheckin(createEmptyCheckin(monthYear, user?.familyId ?? ''));
    } finally {
      setIsLoading(false);
    }
  }, [monthYear, user?.familyId, isGuest]);

  useEffect(() => {
    loadCheckin();
  }, [loadCheckin]);

  const updateCheckin = useCallback((updater: (current: MonthlyCheckin) => MonthlyCheckin) => {
    setCheckin((current) => {
      if (!current) return current;
      return updater(current);
    });
  }, []);

  const saveCheckin = useCallback(async () => {
    // Guests: silently no-op, data is local only
    if (isGuest) return;
    if (!checkin) return;
    setIsSaving(true);
    setError(null);
    try {
      const saved = await apiSaveCheckin({
        ...checkin,
        updatedAt: new Date().toISOString(),
      });
      setCheckin(saved);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to save');
      throw err;
    } finally {
      setIsSaving(false);
    }
  }, [checkin, isGuest]);

  const value = useMemo(
    () => ({
      monthYear,
      setMonthYear,
      checkin,
      isLoading,
      isSaving,
      error,
      updateCheckin,
      saveCheckin,
      reload: loadCheckin,
    }),
    [monthYear, checkin, isLoading, isSaving, error, updateCheckin, saveCheckin, loadCheckin],
  );

  return <CheckinContext.Provider value={value}>{children}</CheckinContext.Provider>;
}

export function useCheckin() {
  const context = useContext(CheckinContext);
  if (!context) {
    throw new Error('useCheckin must be used within CheckinProvider');
  }
  return context;
}
