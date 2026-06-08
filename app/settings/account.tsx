import { useAuth } from '@/contexts/AuthContext';
import { usePreferences } from '@/contexts/PreferencesContext';
import { useColors } from '@/contexts/ThemeContext';
import { confirmEmailChange, requestEmailChange } from '@/lib/api';
import { type Colors, radius, shadow, spacing, typography } from '@/lib/design-tokens';
import { router } from 'expo-router';
import { useMemo, useState } from 'react';
import {
  ActivityIndicator,
  Pressable,
  ScrollView,
  StyleSheet,
  Text,
  TextInput,
  View,
} from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

const AVATAR_EMOJIS = [
  '🏡', '🌿', '💎', '🦁', '🐼', '🦊', '🐻', '🐸',
  '🌸', '🌊', '🔥', '⚡', '🎯', '🚀', '💡', '🎸',
  '🍀', '🌙', '☀️', '❄️', '🦋', '🎨', '📚', '🎵',
];

function Divider() {
  const colors = useColors();
  const styles = useMemo(() => makeStyles(colors), [colors]);
  return <View style={styles.divider} />;
}

// Email change steps: idle → enterEmail → otpSent → done
type EmailStep = 'idle' | 'enterEmail' | 'otpSent';

export default function AccountSettingsScreen() {
  const colors = useColors();
  const styles = useMemo(() => makeStyles(colors), [colors]);
  const { user, logout, isGuest, updateUser } = useAuth();
  const { prefs, setAvatarEmoji } = usePreferences();
  const insets = useSafeAreaInsets();

  const [editingName, setEditingName] = useState(false);
  const [nameInput, setNameInput] = useState(user?.displayName ?? '');
  const [showAvatarPicker, setShowAvatarPicker] = useState(false);

  // Email change state
  const [emailStep, setEmailStep] = useState<EmailStep>('idle');
  const [newEmailInput, setNewEmailInput] = useState('');
  const [otpInput, setOtpInput] = useState('');
  const [emailError, setEmailError] = useState('');
  const [emailLoading, setEmailLoading] = useState(false);

  const textOnBg = colors.text;

  async function handleSaveName() {
    if (!nameInput.trim() || !user) return;
    updateUser({ ...user, displayName: nameInput.trim() }, '');
    setEditingName(false);
  }

  function resetEmailFlow() {
    setEmailStep('idle');
    setNewEmailInput('');
    setOtpInput('');
    setEmailError('');
    setEmailLoading(false);
  }

  async function handleSendOtp() {
    setEmailError('');
    if (!newEmailInput.trim()) { setEmailError('Enter a new email address.'); return; }
    setEmailLoading(true);
    try {
      await requestEmailChange(newEmailInput.trim());
      setEmailStep('otpSent');
    } catch (err: unknown) {
      setEmailError(err instanceof Error ? err.message : 'Something went wrong.');
    } finally {
      setEmailLoading(false);
    }
  }

  async function handleConfirmOtp() {
    setEmailError('');
    if (!otpInput.trim()) { setEmailError('Enter the 6-digit code.'); return; }
    setEmailLoading(true);
    try {
      const res = await confirmEmailChange(otpInput.trim());
      updateUser(res.user, res.token);
      resetEmailFlow();
    } catch (err: unknown) {
      setEmailError(err instanceof Error ? err.message : 'Invalid or expired code.');
    } finally {
      setEmailLoading(false);
    }
  }

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
        <Text style={styles.title}>Account</Text>
      </View>

      <View style={styles.body}>
        {/* Profile hero */}
        <View style={styles.profileHero}>
          <Pressable
            onPress={() => setShowAvatarPicker((v) => !v)}
            style={[styles.avatarWrap, { backgroundColor: colors.accentLight }]}>
            <Text style={styles.avatarEmoji}>{prefs.avatarEmoji}</Text>
            <View style={styles.avatarEditBadge}>
              <Text style={styles.avatarEditBadgeText}>✏️</Text>
            </View>
          </Pressable>

          {editingName ? (
            <View style={styles.nameEditRow}>
              <TextInput
                value={nameInput}
                onChangeText={setNameInput}
                style={[styles.nameInput, { color: textOnBg }]}
                autoFocus
                returnKeyType="done"
                onSubmitEditing={handleSaveName}
              />
              <Pressable onPress={handleSaveName} style={styles.nameSaveBtn}>
                <Text style={styles.nameSaveBtnText}>Save</Text>
              </Pressable>
            </View>
          ) : (
            <Pressable
              onPress={() => { setNameInput(user?.displayName ?? ''); setEditingName(true); }}
              style={styles.nameRow}>
              <Text style={[styles.profileName, { color: textOnBg }]}>{user?.displayName ?? 'Guest'}</Text>
              <Text style={styles.nameEditHint}>✏️</Text>
            </Pressable>
          )}

          <Text style={[styles.profileEmail, { color: colors.textMuted }]}>
            {isGuest ? 'Browsing as guest' : (user?.email ?? '')}
          </Text>
        </View>

        {/* Avatar picker */}
        {showAvatarPicker && (
          <View style={styles.pickerCard}>
            <Text style={styles.pickerLabel}>Choose your avatar</Text>
            <View style={styles.emojiGrid}>
              {AVATAR_EMOJIS.map((e) => (
                <Pressable
                  key={e}
                  onPress={() => { setAvatarEmoji(e); setShowAvatarPicker(false); }}
                  style={[styles.emojiBtn, prefs.avatarEmoji === e && styles.emojiBtnSelected]}>
                  <Text style={styles.emojiOption}>{e}</Text>
                </Pressable>
              ))}
            </View>
          </View>
        )}

        {/* Account details */}
        <View style={styles.section}>
          <Text style={styles.sectionLabel}>Account</Text>
          <View style={styles.card}>
            {isGuest ? (
              <>
                <Pressable
                  onPress={() => router.push('/register')}
                  style={({ pressed }) => [styles.row, pressed && styles.rowPressed]}>
                  <Text style={styles.rowIcon}>✨</Text>
                  <Text style={styles.rowLabel}>Create account</Text>
                  <Text style={styles.chevron}>›</Text>
                </Pressable>
                <Divider />
                <Pressable
                  onPress={() => router.push('/login')}
                  style={({ pressed }) => [styles.row, pressed && styles.rowPressed]}>
                  <Text style={styles.rowIcon}>🔐</Text>
                  <Text style={styles.rowLabel}>Sign in</Text>
                  <Text style={styles.chevron}>›</Text>
                </Pressable>
              </>
            ) : (
              <>
                <Pressable
                  onPress={() => { setNameInput(user?.displayName ?? ''); setEditingName(true); }}
                  style={({ pressed }) => [styles.row, pressed && styles.rowPressed]}>
                  <Text style={styles.rowIcon}>👤</Text>
                  <Text style={[styles.rowLabel, { flex: 1 }]}>Display name</Text>
                  <Text style={styles.rowValue}>{user?.displayName}</Text>
                  <Text style={styles.chevron}>›</Text>
                </Pressable>
                <Divider />
                {/* Email row */}
                {emailStep === 'idle' ? (
                  <Pressable
                    onPress={() => { setNewEmailInput(''); setEmailStep('enterEmail'); }}
                    style={({ pressed }) => [styles.row, pressed && styles.rowPressed]}>
                    <Text style={styles.rowIcon}>📧</Text>
                    <Text style={[styles.rowLabel, { flex: 1 }]}>Email</Text>
                    <Text style={styles.rowValue}>{user?.email}</Text>
                    <Text style={styles.chevron}>›</Text>
                  </Pressable>
                ) : (
                  <View style={styles.emailChangeBlock}>
                    {/* Step 1 — enter new email */}
                    {emailStep === 'enterEmail' && (
                      <>
                        <Text style={styles.emailChangeLabel}>
                          Enter your new email address. We'll send a verification code there.
                        </Text>
                        <TextInput
                          style={styles.emailInput}
                          value={newEmailInput}
                          onChangeText={setNewEmailInput}
                          placeholder="new@email.com"
                          placeholderTextColor={colors.textMuted}
                          keyboardType="email-address"
                          autoCapitalize="none"
                          autoCorrect={false}
                          autoFocus
                        />
                      </>
                    )}

                    {/* Step 2 — enter OTP */}
                    {emailStep === 'otpSent' && (
                      <>
                        <Text style={styles.emailChangeLabel}>
                          A 6-digit code was sent to{' '}
                          <Text style={styles.emailChangeBold}>{newEmailInput}</Text>.
                          Enter it below to confirm.
                        </Text>
                        <TextInput
                          style={[styles.emailInput, styles.otpInput]}
                          value={otpInput}
                          onChangeText={(t) => setOtpInput(t.replace(/\D/g, '').slice(0, 6))}
                          placeholder="000000"
                          placeholderTextColor={colors.textMuted}
                          keyboardType="number-pad"
                          autoFocus
                          maxLength={6}
                        />
                      </>
                    )}

                    {emailError ? <Text style={styles.emailError}>{emailError}</Text> : null}

                    <View style={styles.emailChangeBtns}>
                      <Pressable
                        onPress={resetEmailFlow}
                        style={styles.emailCancelBtn}>
                        <Text style={styles.emailCancelBtnText}>Cancel</Text>
                      </Pressable>
                      <Pressable
                        onPress={emailStep === 'enterEmail' ? handleSendOtp : handleConfirmOtp}
                        disabled={emailLoading}
                        style={[styles.emailConfirmBtn, emailLoading && { opacity: 0.6 }]}>
                        {emailLoading
                          ? <ActivityIndicator size="small" color="#fff" />
                          : <Text style={styles.emailConfirmBtnText}>
                              {emailStep === 'enterEmail' ? 'Send code' : 'Confirm change'}
                            </Text>
                        }
                      </Pressable>
                    </View>
                  </View>
                )}
              </>
            )}
          </View>
        </View>

        {/* Sign out */}
        {!isGuest && (
          <View style={styles.section}>
            <View style={styles.card}>
              <Pressable
                onPress={async () => { await logout(); router.replace('/welcome'); }}
                style={({ pressed }) => [styles.row, pressed && styles.rowPressed]}>
                <Text style={styles.rowIcon}>🚪</Text>
                <Text style={[styles.rowLabel, styles.rowLabelDestructive]}>Sign out</Text>
              </Pressable>
            </View>
          </View>
        )}
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

  profileHero: { alignItems: 'center', paddingVertical: spacing.md, gap: spacing.sm },
  avatarWrap: {
    width: 88, height: 88, borderRadius: 44,
    alignItems: 'center', justifyContent: 'center',
    ...shadow.elevated,
  },
  avatarEmoji: { fontSize: 44 },
  avatarEditBadge: {
    position: 'absolute', bottom: 0, right: 0,
    width: 26, height: 26, borderRadius: 13,
    backgroundColor: colors.surface, alignItems: 'center', justifyContent: 'center',
    ...shadow.card,
  },
  avatarEditBadgeText: { fontSize: 13 },
  nameRow: { flexDirection: 'row', alignItems: 'center', gap: 6 },
  profileName: { fontSize: 22, fontFamily: 'Inter_600SemiBold', fontWeight: '600', letterSpacing: -0.3 },
  nameEditHint: { fontSize: 14, opacity: 0.5 },
  nameEditRow: { flexDirection: 'row', alignItems: 'center', gap: spacing.sm },
  nameInput: {
    fontSize: 20, fontFamily: 'Inter_600SemiBold', fontWeight: '600',
    borderBottomWidth: 1.5, borderBottomColor: colors.accent,
    paddingVertical: 4, minWidth: 140, textAlign: 'center',
  },
  nameSaveBtn: {
    backgroundColor: colors.accent, borderRadius: radius.sm,
    paddingVertical: 6, paddingHorizontal: spacing.md,
  },
  nameSaveBtnText: { fontSize: 13, fontFamily: 'Inter_600SemiBold', fontWeight: '600', color: '#fff' },
  profileEmail: { ...typography.caption },

  pickerCard: {
    backgroundColor: colors.surface, borderRadius: radius.lg,
    padding: spacing.md, borderWidth: 1, borderColor: colors.borderLight,
  },
  pickerLabel: { ...typography.label, color: colors.textMuted, marginBottom: spacing.md },
  emojiGrid: { flexDirection: 'row', flexWrap: 'wrap', gap: spacing.sm },
  emojiBtn: {
    width: 44, height: 44, borderRadius: 22,
    alignItems: 'center', justifyContent: 'center',
    backgroundColor: colors.background,
  },
  emojiBtnSelected: { backgroundColor: colors.accentLight, borderWidth: 2, borderColor: colors.accent },
  emojiOption: { fontSize: 24 },

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
    flexDirection: 'row', alignItems: 'center',
    paddingHorizontal: spacing.md, paddingVertical: 14, gap: spacing.md,
  },
  rowPressed: { backgroundColor: colors.background },
  rowIcon: { fontSize: 18, width: 26, textAlign: 'center' },
  rowLabel: { ...typography.body, color: colors.text },
  rowLabelDestructive: { color: colors.negative },
  rowValue: { ...typography.caption, color: colors.textMuted, maxWidth: 160, textAlign: 'right' },
  chevron: { fontSize: 20, color: colors.textMuted, marginLeft: 2 },
  divider: { height: StyleSheet.hairlineWidth, backgroundColor: colors.borderLight, marginLeft: 58 },

  emailChangeBlock: {
    padding: spacing.md,
    gap: spacing.sm,
  },
  emailChangeLabel: {
    ...typography.caption,
    color: colors.textSecondary,
    lineHeight: 18,
  },
  emailChangeBold: {
    fontFamily: 'Inter_600SemiBold',
    fontWeight: '600',
    color: colors.text,
  },
  emailInput: {
    ...typography.body,
    color: colors.text,
    backgroundColor: colors.background,
    borderWidth: 1.5,
    borderColor: colors.border,
    borderRadius: radius.sm,
    paddingHorizontal: spacing.md,
    paddingVertical: 11,
  },
  otpInput: {
    letterSpacing: 6,
    textAlign: 'center',
    fontSize: 22,
    fontFamily: 'Inter_600SemiBold',
    fontWeight: '600',
  },
  emailError: {
    ...typography.caption,
    color: colors.negative,
  },
  emailChangeBtns: {
    flexDirection: 'row',
    gap: spacing.sm,
    marginTop: spacing.xs,
  },
  emailCancelBtn: {
    flex: 1,
    borderWidth: 1,
    borderColor: colors.border,
    borderRadius: radius.sm,
    paddingVertical: 10,
    alignItems: 'center',
  },
  emailCancelBtnText: {
    ...typography.body,
    color: colors.textSecondary,
    fontSize: 14,
  },
  emailConfirmBtn: {
    flex: 2,
    backgroundColor: colors.accent,
    borderRadius: radius.sm,
    paddingVertical: 10,
    alignItems: 'center',
    justifyContent: 'center',
    minHeight: 40,
  },
  emailConfirmBtnText: {
    ...typography.body,
    color: '#fff',
    fontFamily: 'Inter_600SemiBold',
    fontWeight: '600',
    fontSize: 14,
  },
}); }
