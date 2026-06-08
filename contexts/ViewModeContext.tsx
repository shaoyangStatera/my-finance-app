/**
 * ViewModeContext — "Me" vs "Family" view toggle.
 *
 * Provides a shared toggle state so all tabs stay in sync when the user switches.
 * Also exports a ready-to-use <ViewToggle /> component and a helper hook
 * `useFilteredCheckin` that returns the checkin filtered to the current user
 * when in "me" mode.
 */
import {
  createContext,
  ReactNode,
  useCallback,
  useContext,
  useMemo,
  useState,
} from 'react';
import { Pressable, StyleSheet, Text, View } from 'react-native';
import { useAuth } from './AuthContext';
import { useFamily } from './FamilyContext';
import { useCheckin } from './CheckinContext';
import { useColors } from '@/contexts/ThemeContext';
import { radius, spacing, typography } from '@/lib/design-tokens';
import type { MonthlyCheckin } from '@/lib/types';

// ─── Types ────────────────────────────────────────────────────────────────────

export type ViewMode = 'family' | 'me';

interface ViewModeContextValue {
  viewMode: ViewMode;
  setViewMode: (mode: ViewMode) => void;
  isMultiMember: boolean;
}

// ─── Context ──────────────────────────────────────────────────────────────────

const ViewModeContext = createContext<ViewModeContextValue | null>(null);

export function ViewModeProvider({ children }: { children: ReactNode }) {
  const { family } = useFamily();
  const [viewMode, setViewMode] = useState<ViewMode>('family');

  const isMultiMember = (family?.members.length ?? 0) > 1;

  const value = useMemo(
    () => ({ viewMode, setViewMode, isMultiMember }),
    [viewMode, isMultiMember],
  );

  return (
    <ViewModeContext.Provider value={value}>
      {children}
    </ViewModeContext.Provider>
  );
}

export function useViewMode() {
  const ctx = useContext(ViewModeContext);
  if (!ctx) throw new Error('useViewMode must be used within ViewModeProvider');
  return ctx;
}

// ─── Filter helper ────────────────────────────────────────────────────────────

function filterCheckinForUser(checkin: MonthlyCheckin, userId: string): MonthlyCheckin {
  return {
    ...checkin,
    cpf: userId in checkin.cpf ? { [userId]: checkin.cpf[userId] } : {},
    ledger: {
      ...checkin.ledger,
      income: userId in checkin.ledger.income
        ? { [userId]: checkin.ledger.income[userId] }
        : {},
      // Fixed expenses are household-shared — keep in full
      discretionary: checkin.ledger.discretionary.filter((d) => d.owner === userId),
    },
    investments: checkin.investments.filter((i) => i.owner === userId),
    insurance: checkin.insurance.filter((i) => i.owner === userId),
  };
}

/**
 * Returns a filtered checkin in "me" view, or the full checkin in "family" view.
 * Also returns the active member list filtered to just the current user in "me" mode.
 */
export function useFilteredCheckin() {
  const { user, isGuest } = useAuth();
  const { checkin } = useCheckin();
  const { viewMode, isMultiMember } = useViewMode();
  const { family } = useFamily();

  const allMembers: { userId: string; displayName: string }[] =
    family?.members.map((m) => ({ userId: m.userId, displayName: m.displayName })) ?? [];

  const inMeMode = viewMode === 'me' && isMultiMember && !!user && !isGuest;

  const filteredCheckin = useMemo(() => {
    if (!checkin) return checkin;
    if (!inMeMode || !user) return checkin;
    return filterCheckinForUser(checkin, user._id);
  }, [checkin, inMeMode, user]);

  const activeMembers = useMemo(() => {
    if (!inMeMode || !user) return allMembers;
    const me = allMembers.find((m) => m.userId === user._id);
    return me ? [me] : allMembers;
  }, [inMeMode, user, allMembers]);

  return { filteredCheckin, activeMembers, inMeMode };
}

// ─── ViewToggle component ─────────────────────────────────────────────────────

/**
 * Drop this anywhere above the Edit button on a page.
 * It auto-hides when the user has no family or is a solo member.
 */
export function ViewToggle() {
  const { user, isGuest } = useAuth();
  const { viewMode, setViewMode, isMultiMember } = useViewMode();
  const colors = useColors();

  if (isGuest || !user || !isMultiMember) return null;

  return (
    <View style={[staticToggleStyles.row, { backgroundColor: colors.background, borderColor: colors.border }]}>
      <Pressable
        onPress={() => setViewMode('family')}
        style={[staticToggleStyles.btn, viewMode === 'family' && { backgroundColor: colors.accent }]}>
        <Text style={[staticToggleStyles.btnText, { color: viewMode === 'family' ? '#fff' : colors.textSecondary }]}>
          Family
        </Text>
      </Pressable>
      <Pressable
        onPress={() => setViewMode('me')}
        style={[staticToggleStyles.btn, viewMode === 'me' && { backgroundColor: colors.accent }]}>
        <Text style={[staticToggleStyles.btnText, { color: viewMode === 'me' ? '#fff' : colors.textSecondary }]}>
          Me
        </Text>
      </Pressable>
    </View>
  );
}

const staticToggleStyles = StyleSheet.create({
  row: {
    flexDirection: 'row',
    alignSelf: 'flex-start',
    borderWidth: 1,
    borderRadius: radius.sm,
    marginBottom: spacing.sm,
    overflow: 'hidden',
  },
  btn: { paddingVertical: 7, paddingHorizontal: spacing.md },
  btnText: {
    ...typography.label,
    textTransform: 'none',
    letterSpacing: 0,
    fontSize: 13,
  },
});
