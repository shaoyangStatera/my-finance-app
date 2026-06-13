import { BarCompareChart, PieChartCard } from '@/components/charts';
import { Card, Screen, Stat } from '@/components/ui';
import { useAuth } from '@/contexts/AuthContext';
import { useCheckin } from '@/contexts/CheckinContext';
import { useFamily, useMemberNames } from '@/contexts/FamilyContext';
import { useHousing } from '@/contexts/HousingContext';
import { useFilteredCheckin, useViewMode } from '@/contexts/ViewModeContext';
import { router } from 'expo-router';
import {
  netSavings,
  savingsRate,
  totalCpf,
  totalInvestments,
  totalInsurancePremiums,
} from '@/lib/calculations';
import {
  cashflowBreakdown,
  cpfByAccountType,
  householdWealthMix,
  incomeByPerson,
  monthlyOutflowBreakdown,
} from '@/lib/chart-data';
import { HOUSING_STAGE_LABELS } from '@/lib/types';
import { formatCurrency, formatMonthYear } from '@/lib/format';
import { useColors } from '@/contexts/ThemeContext';
import { type Colors, radius, shadow, spacing, typography } from '@/lib/design-tokens';
import { useMemo } from 'react';
import { NotificationBell } from '@/components/NotificationBell';
import { LinearGradient } from 'expo-linear-gradient';
import { ActivityIndicator, Pressable, StyleSheet, Text, View } from 'react-native';

// ─── Hero view toggle (styled for dark gradient background) ──────────────────

// Hero toggle styles are fixed (rendered on gradient, not theme surfaces)
const heroToggleStyles = StyleSheet.create({
  viewToggle: {
    flexDirection: 'row',
    backgroundColor: 'rgba(0,0,0,0.2)',
    borderRadius: 99,
    padding: 2,
    gap: 0,
  },
  toggleBtn: {
    paddingVertical: 5,
    paddingHorizontal: 14,
    borderRadius: 99,
  },
  toggleBtnActive: {
    backgroundColor: 'rgba(255,255,255,0.95)',
  },
  toggleBtnText: {
    fontSize: 12,
    fontFamily: 'Inter_600SemiBold',
    fontWeight: '600',
    color: 'rgba(255,255,255,0.65)',
  },
});

function HeroViewToggle() {
  const { viewMode, setViewMode } = useViewMode();
  const colors = useColors();
  return (
    <View style={heroToggleStyles.viewToggle}>
      <Pressable
        onPress={() => setViewMode('family')}
        style={[heroToggleStyles.toggleBtn, viewMode === 'family' && heroToggleStyles.toggleBtnActive]}>
        <Text style={[heroToggleStyles.toggleBtnText, viewMode === 'family' && { color: colors.text }]}>
          Family
        </Text>
      </Pressable>
      <Pressable
        onPress={() => setViewMode('me')}
        style={[heroToggleStyles.toggleBtn, viewMode === 'me' && heroToggleStyles.toggleBtnActive]}>
        <Text style={[heroToggleStyles.toggleBtnText, viewMode === 'me' && { color: colors.text }]}>
          Me
        </Text>
      </Pressable>
    </View>
  );
}

// ─── Screen ──────────────────────────────────────────────────────────────────

export default function OverviewScreen() {
  const colors = useColors();
  const styles = useMemo(() => makeStyles(colors), [colors]);
  const { user, isGuest } = useAuth();
  const { monthYear, checkin, isLoading } = useCheckin();
  const { housing } = useHousing();
  const { family } = useFamily();
  const memberNames = useMemberNames();
  const { filteredCheckin, inMeMode } = useFilteredCheckin();
  const { viewMode, isMultiMember } = useViewMode();

  if (isLoading || !checkin || !filteredCheckin) {
    return (
      <View style={styles.loading}>
        <ActivityIndicator color={colors.accent} size="large" />
      </View>
    );
  }

  const activeCheckin = filteredCheckin;
  const savings = netSavings(activeCheckin);
  const rate = savingsRate(activeCheckin);

  const heroTitle = inMeMode
    ? (user?.displayName ?? 'My overview')
    : (family?.name ?? 'Nestworth');

  return (
    <Screen>
      {/* Guest banner */}
      {isGuest && (
        <Pressable
          onPress={() => router.push('/register')}
          style={styles.guestBanner}>
          <Text style={styles.guestBannerText}>
            👤 You're browsing as a guest — data won't be saved.
          </Text>
          <Text style={styles.guestBannerCta}>Create account →</Text>
        </Pressable>
      )}

      {/* Hero gradient header */}
      <LinearGradient
        colors={[colors.heroFrom, colors.heroTo]}
        start={{ x: 0, y: 0 }}
        end={{ x: 1, y: 1 }}
        style={styles.hero}>
        <View style={styles.heroTop}>
          <View style={styles.heroTitleCol}>
            <Text style={styles.greeting}>{heroTitle}</Text>
            <Text style={styles.period}>{formatMonthYear(monthYear)} check-in</Text>
          </View>

          {/* View toggle — only shown when in a multi-member family */}
          {!isGuest && isMultiMember && (
            <HeroViewToggle />
          )}
          <NotificationBell tint="light" />
        </View>

        <View style={styles.heroStats}>
          <View style={styles.heroStat}>
            <Text style={styles.heroStatLabel}>Net savings</Text>
            <Text style={[styles.heroStatValue, savings < 0 && styles.heroStatNegative]}>
              {formatCurrency(savings)}
            </Text>
            <Text style={styles.heroStatHint}>{rate.toFixed(1)}% rate</Text>
          </View>
          <View style={styles.heroStatDivider} />
          <View style={styles.heroStat}>
            <Text style={styles.heroStatLabel}>Total CPF</Text>
            <Text style={styles.heroStatValue}>{formatCurrency(totalCpf(activeCheckin))}</Text>
          </View>
          <View style={styles.heroStatDivider} />
          <View style={styles.heroStat}>
            <Text style={styles.heroStatLabel}>Investments</Text>
            <Text style={styles.heroStatValue}>{formatCurrency(totalInvestments(activeCheckin))}</Text>
          </View>
        </View>
      </LinearGradient>

      <PieChartCard
        title="Where income goes"
        subtitle="Fixed, discretionary, and savings"
        data={cashflowBreakdown(activeCheckin)}
        centerLabel="Income"
      />

      {/* Income split only meaningful in family view with multiple members */}
      {!inMeMode && isMultiMember && (
        <PieChartCard
          title="Income split"
          subtitle="By family member"
          data={incomeByPerson(activeCheckin, memberNames)}
        />
      )}

      <PieChartCard
        title="Monthly outflows"
        subtitle="Excluding CPF and investments"
        data={monthlyOutflowBreakdown(activeCheckin)}
      />

      <PieChartCard
        title={inMeMode ? 'My assets' : 'Household assets'}
        subtitle="CPF balances and investments"
        data={householdWealthMix(activeCheckin)}
      />

      <PieChartCard
        title="CPF by account"
        subtitle="Combined OA, SA, and MediSave"
        data={cpfByAccountType(activeCheckin)}
      />

      <Card>
        <Stat
          label="Insurance premiums"
          value={formatCurrency(totalInsurancePremiums(activeCheckin))}
          hint="Monthly total across all policies"
        />
      </Card>

      {housing && (
        <Card>
          <Text style={styles.cardLabel}>Housing</Text>
          <Text style={styles.projectName}>{housing.projectName || 'Property'}</Text>
          {housing.address ? <Text style={styles.address}>{housing.address}</Text> : null}
          <View style={styles.stagePill}>
            <Text style={styles.stagePillText}>{housing.currentStage || 'Not started'}</Text>
          </View>
          {housing.currentStage && HOUSING_STAGE_LABELS[housing.currentStage]?.pending ? (
            <Text style={styles.stagePendingMsg}>
              {HOUSING_STAGE_LABELS[housing.currentStage].pending}
            </Text>
          ) : null}
        </Card>
      )}

      {checkin.notes ? (
        <Card tinted>
          <Text style={styles.cardLabel}>Notes</Text>
          <Text style={styles.notes}>{checkin.notes}</Text>
        </Card>
      ) : null}
    </Screen>
  );
}

function makeStyles(colors: Colors) { return StyleSheet.create({
  loading: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: colors.background,
  },
  hero: {
    borderRadius: radius.lg,
    padding: spacing.lg,
    marginTop: spacing.lg,
    marginBottom: spacing.md,
    ...shadow.elevated,
  },
  heroTop: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'flex-start',
    marginBottom: spacing.lg,
  },
  heroTitleCol: { flex: 1 },
  greeting: {
    fontSize: 22,
    fontWeight: '600',
    fontFamily: 'Inter_600SemiBold',
    color: '#FFFFFF',
    letterSpacing: -0.3,
  },
  period: {
    ...typography.caption,
    color: 'rgba(255,255,255,0.6)',
    marginTop: spacing.xs,
  },

  // View toggle
  viewToggle: {
    flexDirection: 'row',
    backgroundColor: 'rgba(0,0,0,0.2)',
    borderRadius: 99,
    padding: 2,
    gap: 0,
  },
  toggleBtn: {
    paddingVertical: 5,
    paddingHorizontal: 14,
    borderRadius: 99,
  },
  toggleBtnActive: {
    backgroundColor: 'rgba(255,255,255,0.95)',
  },
  toggleBtnText: {
    fontSize: 12,
    fontFamily: 'Inter_600SemiBold',
    fontWeight: '600',
    color: 'rgba(255,255,255,0.65)',
  },

  heroStats: {
    flexDirection: 'row',
    alignItems: 'center',
  },
  heroStat: {
    flex: 1,
  },
  heroStatDivider: {
    width: 1,
    height: 36,
    backgroundColor: 'rgba(255,255,255,0.2)',
    marginHorizontal: spacing.sm,
  },
  heroStatLabel: {
    ...typography.label,
    color: 'rgba(255,255,255,0.55)',
    marginBottom: spacing.xs,
    fontSize: 10,
  },
  heroStatValue: {
    fontSize: 16,
    fontWeight: '600',
    fontFamily: 'Inter_600SemiBold',
    color: '#FFFFFF',
    letterSpacing: -0.3,
  },
  heroStatNegative: {
    color: '#FFB3AE',
  },
  heroStatHint: {
    ...typography.caption,
    color: 'rgba(255,255,255,0.5)',
    fontSize: 11,
    marginTop: 2,
  },
  cardLabel: {
    ...typography.label,
    color: colors.textMuted,
    marginBottom: spacing.sm,
  },
  projectName: {
    ...typography.bodyMedium,
    color: colors.text,
    fontSize: 16,
  },
  address: {
    ...typography.caption,
    color: colors.textSecondary,
    marginTop: spacing.xs,
  },
  stagePill: {
    alignSelf: 'flex-start',
    backgroundColor: colors.accentLight,
    borderRadius: 99,
    paddingVertical: 4,
    paddingHorizontal: spacing.md,
    marginTop: spacing.sm,
  },
  stagePillText: {
    ...typography.label,
    color: colors.accent,
    textTransform: 'none',
    letterSpacing: 0,
    fontSize: 12,
  },
  stagePendingMsg: {
    ...typography.caption,
    color: colors.textSecondary,
    marginTop: spacing.sm,
  },
  notes: {
    ...typography.body,
    color: colors.textSecondary,
  },
  guestBanner: {
    marginTop: spacing.lg,
    backgroundColor: colors.warningLight,
    borderRadius: radius.md,
    padding: spacing.md,
    borderWidth: 1,
    borderColor: '#E8D5A3',
    gap: 4,
  },
  guestBannerText: {
    ...typography.caption,
    color: colors.warning,
    lineHeight: 18,
  },
  guestBannerCta: {
    fontSize: 13,
    fontFamily: 'Inter_600SemiBold',
    fontWeight: '600',
    color: colors.warning,
  },
}); }
