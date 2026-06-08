import { NotificationBell } from '@/components/NotificationBell';
import { useAuth } from '@/contexts/AuthContext';
import { useFamily } from '@/contexts/FamilyContext';
import { usePreferences } from '@/contexts/PreferencesContext';
import { useColors } from '@/contexts/ThemeContext';
import { type Colors, radius, shadow, spacing, typography } from '@/lib/design-tokens';
import { router } from 'expo-router';
import { useMemo } from 'react';
import {
  Linking,
  Pressable,
  ScrollView,
  StyleSheet,
  Switch,
  Text,
  View,
} from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

// ─── Reusable primitives ──────────────────────────────────────────────────────

function Section({ title, children }: { title: string; children: React.ReactNode }) {
  const colors = useColors();
  const styles = useMemo(() => makeStyles(colors), [colors]);
  return (
    <View style={styles.section}>
      {title ? <Text style={styles.sectionTitle}>{title}</Text> : null}
      <View style={styles.sectionCard}>{children}</View>
    </View>
  );
}

function Row({
  icon, label, value, onPress, destructive, chevron = true, rightElement,
}: {
  icon: string;
  label: string;
  value?: string;
  onPress?: () => void;
  destructive?: boolean;
  chevron?: boolean;
  rightElement?: React.ReactNode;
}) {
  const colors = useColors();
  const styles = useMemo(() => makeStyles(colors), [colors]);
  return (
    <Pressable
      onPress={onPress}
      disabled={!onPress && !rightElement}
      style={({ pressed }) => [styles.row, pressed && onPress && styles.rowPressed]}>
      <Text style={styles.rowIcon}>{icon}</Text>
      <Text style={[styles.rowLabel, destructive && styles.rowLabelDestructive]}>{label}</Text>
      {value ? <Text style={styles.rowValue}>{value}</Text> : null}
      {rightElement ?? (chevron && onPress ? <Text style={styles.chevron}>›</Text> : null)}
    </Pressable>
  );
}

function Divider() {
  const colors = useColors();
  const styles = useMemo(() => makeStyles(colors), [colors]);
  return <View style={styles.divider} />;
}

// ─── Main screen ──────────────────────────────────────────────────────────────

export default function SettingsScreen() {
  const colors = useColors();
  const styles = useMemo(() => makeStyles(colors), [colors]);
  const { user, isGuest, logout } = useAuth();
  const { family } = useFamily();
  const { prefs, setDarkMode } = usePreferences();
  const insets = useSafeAreaInsets();

  return (
    <ScrollView
      style={[styles.root, { backgroundColor: colors.background }]}
      contentContainerStyle={[styles.content, { paddingTop: insets.top + spacing.lg, paddingBottom: insets.bottom + spacing.xl }]}
      showsVerticalScrollIndicator={false}>

      {/* Bell in top-right */}
      <View style={styles.settingsTopBar}>
        <NotificationBell />
      </View>

      {/* Profile hero — taps to account page */}
      <Pressable
        onPress={() => router.push('/settings/account')}
        style={styles.profileHero}>
        <View style={[styles.avatarWrap, { backgroundColor: colors.accentLight }]}>
          <Text style={styles.avatarEmoji}>{prefs.avatarEmoji}</Text>
        </View>
        <Text style={[styles.profileName, { color: colors.text }]}>{user?.displayName ?? 'Guest'}</Text>
        <Text style={[styles.profileEmail, { color: colors.textMuted }]}>
          {isGuest ? 'Browsing as guest' : (user?.email ?? '')}
        </Text>
      </Pressable>

      {/* Appearance */}
      <Section title="Appearance">
        <Row
          icon="🌙"
          label="Dark mode"
          chevron={false}
          rightElement={
            <Switch
              value={prefs.darkMode}
              onValueChange={setDarkMode}
              trackColor={{ false: colors.border, true: colors.accent }}
              thumbColor={prefs.darkMode ? colors.accentText : colors.surface}
            />
          }
        />
      </Section>

      {/* Account */}
      <Section title="Account">
        <Row icon="👤" label="Account settings" onPress={() => router.push('/settings/account')} />
      </Section>

      {/* Notifications */}
      {!isGuest && (
        <Section title="Notifications">
          <Row
            icon="🔔"
            label="Notification preferences"
            onPress={() => router.push('/settings/notifications')}
          />
        </Section>
      )}

      {/* Family group */}
      {!isGuest && (
        <Section title="Family group">
          <Row
            icon="👨‍👩‍👧"
            label={family ? family.name : 'Set up family group'}
            value={family ? `${family.members.length} member${family.members.length !== 1 ? 's' : ''}` : undefined}
            onPress={() => router.push('/settings/family')}
          />
          {family && family.pendingRequests.length > 0 && (
            <>
              <Divider />
              <Row
                icon="🕐"
                label={`${family.pendingRequests.length} pending request${family.pendingRequests.length !== 1 ? 's' : ''}`}
                onPress={() => router.push('/settings/family')}
              />
            </>
          )}
        </Section>
      )}

      {/* Support */}
      <Section title="Support">
        <Row
          icon="☕"
          label="Buy me a coffee"
          value="Support Nestworth"
          onPress={() => Linking.openURL('https://buymeacoffee.com/shaoyangchin')}
        />
      </Section>

      {/* Legal */}
      <Section title="Legal">
        <Row
          icon="📄"
          label="Terms of Service"
          onPress={() => Linking.openURL('https://nestworth.app/terms')}
        />
        <Divider />
        <Row
          icon="🔒"
          label="Privacy Policy"
          onPress={() => Linking.openURL('https://nestworth.app/privacy')}
        />
      </Section>

      {/* Sign out */}
      {!isGuest && (
        <Section title="">
          <Row
            icon="🚪"
            label="Sign out"
            destructive
            onPress={async () => { await logout(); router.replace('/welcome'); }}
          />
        </Section>
      )}

      {/* About */}
      <View style={styles.aboutBlock}>
        <Text style={[styles.aboutText, { color: colors.textMuted }]}>Version 1.0.0</Text>
        <Text style={[styles.aboutText, { color: colors.textMuted }]}>Built with ♥ in Singapore</Text>
      </View>
    </ScrollView>
  );
}

// ─── Styles ───────────────────────────────────────────────────────────────────

function makeStyles(colors: Colors) { return StyleSheet.create({
  root: { flex: 1 },
  content: { paddingHorizontal: spacing.lg, gap: spacing.md },

  settingsTopBar: { alignItems: 'flex-end', marginBottom: -spacing.sm },
  profileHero: { alignItems: 'center', paddingVertical: spacing.lg, gap: spacing.sm },
  avatarWrap: {
    width: 88, height: 88, borderRadius: 44,
    alignItems: 'center', justifyContent: 'center',
    ...shadow.elevated,
  },
  avatarEmoji: { fontSize: 44 },
  profileName: { fontSize: 22, fontFamily: 'Inter_600SemiBold', fontWeight: '600', letterSpacing: -0.3 },
  profileEmail: { ...typography.caption },

  section: { gap: spacing.xs },
  sectionTitle: { ...typography.label, color: colors.textMuted, paddingHorizontal: 4, marginBottom: 2 },
  sectionCard: {
    backgroundColor: colors.surface, borderRadius: radius.lg,
    borderWidth: 1, borderColor: colors.borderLight,
    overflow: 'hidden',
  },

  row: {
    flexDirection: 'row', alignItems: 'center',
    paddingHorizontal: spacing.md, paddingVertical: 14, gap: spacing.md,
  },
  rowPressed: { backgroundColor: colors.borderLight },
  rowIcon: { fontSize: 18, width: 26, textAlign: 'center' },
  rowLabel: { flex: 1, ...typography.body, color: colors.text },
  rowLabelDestructive: { color: colors.negative },
  rowValue: { ...typography.caption, color: colors.textMuted, maxWidth: 140, textAlign: 'right' },
  chevron: { fontSize: 20, color: colors.textMuted, marginLeft: 2 },
  divider: { height: StyleSheet.hairlineWidth, backgroundColor: colors.borderLight, marginLeft: 58 },

  aboutBlock: { alignItems: 'center', paddingVertical: spacing.lg, gap: spacing.xs },
  aboutText: { ...typography.caption },
}); }
