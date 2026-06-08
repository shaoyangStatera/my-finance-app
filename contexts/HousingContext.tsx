import { createContext, ReactNode, useCallback, useContext, useEffect, useMemo, useState } from 'react';
import { fetchHousing, saveHousing as apiSaveHousing } from '@/lib/api';
import type { HousingData } from '@/lib/types';
import { useAuth } from './AuthContext';

const EMPTY_HOUSING: HousingData = {
  familyId: '',
  housingType: '',
  projectName: '',
  address: '',
  roomType: '',
  flatPrice: 0,
  currentStage: '',
  nextMilestoneDate: '',
  milestoneDates: {},
  milestoneExtras: {},
  bookingFee: 0,
  downpayment: 0,
  subsidyClawbackRate: 0,
  notes: '',
};

interface HousingContextValue {
  housing: HousingData | null;
  isLoading: boolean;
  isSaving: boolean;
  error: string | null;
  updateHousing: (updater: (current: HousingData) => HousingData) => void;
  saveHousing: () => Promise<void>;
  reload: () => Promise<void>;
}

const HousingContext = createContext<HousingContextValue | null>(null);

export function HousingProvider({ children }: { children: ReactNode }) {
  const { isAuthenticated, user, isGuest } = useAuth();
  const [housing, setHousing] = useState<HousingData | null>(null);
  const [isLoading, setIsLoading] = useState(false);
  const [isSaving, setIsSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const load = useCallback(async () => {
    // Guests get no housing data — local only
    if (isGuest) { setHousing(null); return; }
    if (!isAuthenticated || !user?.familyId) {
      setHousing(null);
      return;
    }
    setIsLoading(true);
    try {
      const data = await fetchHousing();
      setHousing({ ...EMPTY_HOUSING, ...data });
    } catch {
      setHousing(null); // no housing record yet — that's fine
    } finally {
      setIsLoading(false);
    }
  }, [isAuthenticated, user?.familyId, isGuest]);

  useEffect(() => { load(); }, [load]);

  const updateHousing = useCallback((updater: (current: HousingData) => HousingData) => {
    setHousing((cur) => updater(cur ?? { ...EMPTY_HOUSING, familyId: '' }));
  }, []);

  const saveHousingFn = useCallback(async () => {
    if (isGuest || !housing) return;
    setIsSaving(true);
    setError(null);
    try {
      const saved = await apiSaveHousing(housing);
      setHousing({ ...EMPTY_HOUSING, ...saved });
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to save');
      throw err;
    } finally {
      setIsSaving(false);
    }
  }, [housing, isGuest]);

  const value = useMemo(
    () => ({ housing, isLoading, isSaving, error, updateHousing, saveHousing: saveHousingFn, reload: load }),
    [housing, isLoading, isSaving, error, updateHousing, saveHousingFn, load],
  );

  return <HousingContext.Provider value={value}>{children}</HousingContext.Provider>;
}

export function useHousing() {
  const ctx = useContext(HousingContext);
  if (!ctx) throw new Error('useHousing must be used within HousingProvider');
  return ctx;
}
