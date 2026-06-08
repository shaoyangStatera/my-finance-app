import { createContext, ReactNode, useCallback, useContext, useEffect, useMemo, useState } from 'react';
import { getFamily, createFamily as apiCreateFamily, joinFamily as apiJoinFamily, approveFamilyRequest as apiApprove } from '@/lib/api';
import type { Family } from '@/lib/types';
import { useAuth } from './AuthContext';

interface FamilyContextValue {
  family: Family | null;
  isLoading: boolean;
  error: string | null;
  createFamily: (name: string) => Promise<void>;
  joinFamily: (inviteCode: string) => Promise<string>;
  approveRequest: (userId: string, action: 'approve' | 'reject') => Promise<void>;
  reload: () => Promise<void>;
}

const FamilyContext = createContext<FamilyContextValue | null>(null);

export function FamilyProvider({ children }: { children: ReactNode }) {
  const { user, isAuthenticated, updateUser } = useAuth();
  const [family, setFamily] = useState<Family | null>(null);
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const load = useCallback(async () => {
    if (!isAuthenticated || !user?.familyId) { setFamily(null); return; }
    setIsLoading(true);
    try {
      const data = await getFamily();
      setFamily(data);
    } catch {
      setFamily(null);
    } finally {
      setIsLoading(false);
    }
  }, [isAuthenticated, user?.familyId]);

  useEffect(() => { load(); }, [load]);

  const createFamily = useCallback(async (name: string) => {
    setError(null);
    const result = await apiCreateFamily(name);
    setFamily(result.family);
    updateUser(result.user, result.token);
  }, [updateUser]);

  const joinFamily = useCallback(async (inviteCode: string) => {
    setError(null);
    const result = await apiJoinFamily(inviteCode);
    return result.familyName;
  }, []);

  const approveRequest = useCallback(async (userId: string, action: 'approve' | 'reject') => {
    setError(null);
    await apiApprove(userId, action);
    await load();
  }, [load]);

  const value = useMemo(
    () => ({ family, isLoading, error, createFamily, joinFamily, approveRequest, reload: load }),
    [family, isLoading, error, createFamily, joinFamily, approveRequest, load],
  );

  return <FamilyContext.Provider value={value}>{children}</FamilyContext.Provider>;
}

export function useFamily() {
  const ctx = useContext(FamilyContext);
  if (!ctx) throw new Error('useFamily must be used within FamilyProvider');
  return ctx;
}
