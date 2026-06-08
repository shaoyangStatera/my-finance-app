import { usePreferences } from '@/contexts/PreferencesContext';
import { updateNotificationPrefs } from '@/lib/api';
import { useColors } from '@/contexts/ThemeContext';
import { type Colors, radius, spacing, typography } from '@/lib/design-tokens';
import type { NotificationPrefs } from '@/lib/types';
import { router } from 'expo-router';
import { useCallback, useMemo } from 'react';
import {
  Pressable,
  ScrollView,
  StyleSheet,
  Switch,
  Text,
  View,
} from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

function Divider() {
  const colors = useColors();
  const styles = useMemo(() => makeStyles(colors), [colors]);
  return <View style={styles.divider} />;
}

function ToggleRow({
  icon, label, value, onValueChange,
}: {
  icon: string;
  label: string;
  value: boolean;
  onValueChange: (v: boolean) => void;
}) {
  const colors = useColors();
  const styles = useMemo(() => makeStyles(colors), [colors]);
  return (
    <View style={styles.row}>
      <Text style={styles.rowIcon}>{icon}</Text>
      <Text style={[styles.rowLabel, { flex: 1 }]}>{label}</Text>
      <Switch
        value={value}
        onValueChange={onValueChange}
        trackColor={{ false: colors.border, true: colors.accentLight }}
        thumbColor={value ? colors.accent : colors.textMuted}
      />
    </View>
  );
}

export default function NotificationsSettingsScreen() {
  const colors = useColors();
  const styles = useMemo(() => makeStyles(colors), [colors]);
  const { prefs, setNotifPrefs } = usePreferences();
  const insets = useSafeAreaInsets();

  const handleToggle = useCallback(async (key: keyof NotificationPrefs, value: boolean) => {
    const next: NotificationPrefs = { ...prefs.notifPrefs, [key]: value };
    setNotifPrefs(next);
    try { await updateNotificationPrefs(next); } catch { /* silently fail */ }
  }, [prefs.notifPrefs, setNotifPrefs]);

  return (
    <ScrollView
      style={[styles.root, { backgroundColor: colors.background }]}
      contentContainerStyle={{ paddingTop: insets.top, paddingBottom: insets.bottom + spacing.xl }}
      showsVerticalScrollIndicator={false}>

      {/* Header */}
      <View style={styles.header}>
        <Pressable onPress={() => router.back()} style={styles.backBtn} hitSlop={12}>
          <Text style={styles.backText}>‹ Back</Text>
        </Pressable>
        <Text style={styles.title}>Notification preferences</Text>
      </View>

      <View style={styles.body}>
        <View style={styles.section}>
          <Text style={styles.sectionLabel}>Notify me when someone updates</Text>
          <View style={styles.card}>
            <ToggleRow
              icon="🏦"
              label="CPF data"
              value={prefs.notifPrefs.cpf}
              onValueChange={(v) => handleToggle('cpf', v)}
            />
            <Divider />
            <ToggleRow
              icon="📈"
              label="Investments"
              value={prefs.notifPrefs.investment}
              onValueChange={(v) => handleToggle('investment', v)}
            />
            <Divider />
            <ToggleRow
              icon="💳"
              label="Expenses"
              value={prefs.notifPrefs.expense}
              onValueChange={(v) => handleToggle('expense', v)}
            />
          </View>
        </View>
      </View>
    </ScrollView>
  );
}

function makeStyles(colors: Colors) { return StyleSheet.create({
  root: { flex: 1 },
  header: {
    paddingHorizontal: spacing.lg,
    paddingTop: spacing.md,
    paddingBottom: spacing.lg,
    gap: spacing.xs,
  },
  backBtn: { alignSelf: 'flex-start' },
  backText: { ...typography.body, color: colors.accent, fontSize: 16 },
  title: {
    fontSize: 28,
    fontFamily: 'Inter_600SemiBold',
    fontWeight: '600',
    color: colors.text,
    letterSpacing: -0.5,
  },
  body: { paddingHorizontal: spacing.lg, gap: spacing.md },
  section: { gap: spacing.xs },
  sectionLabel: { ...typography.label, color: colors.textMuted, paddingHorizontal: 4, marginBottom: 2 },
  card: {
    backgroundColor: colors.surface,
    borderRadius: radius.lg,
    borderWidth: 1,
    borderColor: colors.borderLight,
    overflow: 'hidden',
  },
  row: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: spacing.md,
    paddingVertical: 14,
    gap: spacing.md,
  },
  rowPressed: { backgroundColor: colors.background },
  rowIcon: { fontSize: 18, width: 26, textAlign: 'center' },
  rowLabel: { ...typography.body, color: colors.text },
  chevron: { fontSize: 20, color: colors.textMuted, marginLeft: 2 },
  divider: { height: StyleSheet.hairlineWidth, backgroundColor: colors.borderLight, marginLeft: 58 },
}); }
