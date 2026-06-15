import { REGISTRATION_ENABLED, REGISTRATION_DISABLED_MESSAGE } from '@/lib/registration';
import { useColors } from '@/contexts/ThemeContext';
import { type Colors, radius, shadow, spacing, typography } from '@/lib/design-tokens';
import { router } from 'expo-router';
import { useMemo } from 'react';
import { Pressable, ScrollView, StyleSheet, Text, View } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

const FEATURES = [
  { icon: '🏠', label: 'Housing journey', desc: 'BTO, resale, condo — every milestone tracked' },
  { icon: '💰', label: 'CPF at a glance', desc: 'OA, SA, and MediSave across your family' },
  { icon: '📊', label: 'Monthly check-ins', desc: 'Income, expenses, and savings rate' },
  { icon: '👨‍👩‍👧', label: 'Family groups', desc: 'Share data with your partner or family' },
];

export default function WelcomeScreen() {
  const colors = useColors();
  const styles = useMemo(() => makeStyles(colors), [colors]);
  const insets = useSafeAreaInsets();

  return (
    <ScrollView
      style={styles.root}
      contentContainerStyle={[styles.content, { paddingTop: insets.top + spacing.xl, paddingBottom: insets.bottom + spacing.xl }]}
      showsVerticalScrollIndicator={false}>

      {/* Illustration area */}
      <View style={styles.illustrationWrap}>
        <View style={styles.illustrationBg}>
          <Text style={styles.illustrationEmoji}>🏡</Text>
        </View>
        <View style={[styles.badge, styles.badgeTopRight]}>
          <Text style={styles.badgeEmoji}>📈</Text>
        </View>
        <View style={[styles.badge, styles.badgeBottomLeft]}>
          <Text style={styles.badgeEmoji}>💵</Text>
        </View>
      </View>

      {/* Headline */}
      <Text style={styles.title}>Your family's{'\n'}financial home.</Text>
      <Text style={styles.sub}>
        Track housing, CPF, investments, and budgets — together with your family.
      </Text>

      {/* Feature pills */}
      <View style={styles.featureGrid}>
        {FEATURES.map((f) => (
          <View key={f.label} style={styles.featurePill}>
            <Text style={styles.featurePillIcon}>{f.icon}</Text>
            <Text style={styles.featurePillLabel}>{f.label}</Text>
          </View>
        ))}
      </View>

      {/* Actions */}
      <View style={styles.actions}>
        <Pressable
          onPress={() => router.push('/login')}
          style={({ pressed }) => [styles.primaryBtn, pressed && { opacity: 0.88 }]}>
          <Text style={styles.primaryBtnText}>Sign in</Text>
        </Pressable>

        {!REGISTRATION_ENABLED && (
          <Text style={styles.closedNote}>{REGISTRATION_DISABLED_MESSAGE}</Text>
        )}
      </View>

      <Text style={styles.fine}>
        By continuing you agree to our Terms of Service and Privacy Policy.
      </Text>
    </ScrollView>
  );
}

function makeStyles(colors: Colors) { return StyleSheet.create({
  root: {
    flex: 1,
    backgroundColor: colors.surface,
  },
  content: {
    paddingHorizontal: spacing.lg,
    alignItems: 'center',
  },

  // Illustration
  illustrationWrap: {
    width: 180,
    height: 180,
    marginBottom: spacing.xl,
    position: 'relative',
    alignItems: 'center',
    justifyContent: 'center',
  },
  illustrationBg: {
    width: 148,
    height: 148,
    borderRadius: 74,
    backgroundColor: colors.accentLight,
    alignItems: 'center',
    justifyContent: 'center',
  },
  illustrationEmoji: {
    fontSize: 72,
  },
  badge: {
    position: 'absolute',
    width: 48,
    height: 48,
    borderRadius: 24,
    backgroundColor: colors.surface,
    alignItems: 'center',
    justifyContent: 'center',
    ...shadow.elevated,
  },
  badgeTopRight: { top: 10, right: 4 },
  badgeBottomLeft: { bottom: 10, left: 4 },
  badgeEmoji: { fontSize: 22 },

  // Text
  title: {
    fontSize: 36,
    fontWeight: '700',
    fontFamily: 'Inter_600SemiBold',
    color: colors.text,
    letterSpacing: -0.8,
    lineHeight: 42,
    textAlign: 'center',
    marginBottom: spacing.md,
  },
  sub: {
    ...typography.body,
    color: colors.textSecondary,
    textAlign: 'center',
    lineHeight: 22,
    paddingHorizontal: spacing.md,
    marginBottom: spacing.xl,
  },

  // Feature pills
  featureGrid: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: spacing.sm,
    justifyContent: 'center',
    marginBottom: spacing.xl,
  },
  featurePill: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    backgroundColor: colors.background,
    borderRadius: 99,
    paddingVertical: 8,
    paddingHorizontal: spacing.md,
    borderWidth: 1,
    borderColor: colors.borderLight,
  },
  featurePillIcon: { fontSize: 15 },
  featurePillLabel: {
    fontSize: 13,
    fontFamily: 'Inter_500Medium',
    fontWeight: '500',
    color: colors.text,
  },

  // Actions
  actions: {
    width: '100%',
    gap: spacing.sm,
    marginBottom: spacing.md,
  },
  closedNote: {
    ...typography.caption,
    color: colors.textSecondary,
    textAlign: 'center',
    lineHeight: 18,
    paddingHorizontal: spacing.sm,
  },
  primaryBtn: {
    backgroundColor: colors.text,
    borderRadius: 99,
    paddingVertical: 16,
    alignItems: 'center',
    ...shadow.card,
  },
  primaryBtnText: {
    fontSize: 16,
    fontFamily: 'Inter_600SemiBold',
    fontWeight: '600',
    color: '#FFFFFF',
    letterSpacing: -0.2,
  },
  secondaryBtn: {
    borderRadius: 99,
    paddingVertical: 16,
    alignItems: 'center',
    backgroundColor: colors.background,
    borderWidth: 1.5,
    borderColor: colors.border,
  },
  secondaryBtnText: {
    fontSize: 16,
    fontFamily: 'Inter_500Medium',
    fontWeight: '500',
    color: colors.text,
    letterSpacing: -0.2,
  },
  fine: {
    ...typography.caption,
    color: colors.textMuted,
    textAlign: 'center',
    lineHeight: 18,
    paddingHorizontal: spacing.lg,
  },
}); }
