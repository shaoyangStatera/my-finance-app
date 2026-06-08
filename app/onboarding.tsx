import { ApiError } from '@/contexts/AuthContext';
import { useFamily } from '@/contexts/FamilyContext';
import { useAuth } from '@/contexts/AuthContext';
import { Input } from '@/components/ui';
import { useColors } from '@/contexts/ThemeContext';
import { type Colors, radius, shadow, spacing, typography } from '@/lib/design-tokens';
import { router } from 'expo-router';
import { useMemo, useState } from 'react';
import {
  ActivityIndicator,
  KeyboardAvoidingView,
  Platform,
  Pressable,
  ScrollView,
  StyleSheet,
  Text,
  View,
} from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

type Step = 'choice' | 'create' | 'join' | 'join-pending';

const STEP_META: Record<Step, { emoji: string; bg: string; title: string; sub: string }> = {
  choice: {
    emoji: '👨‍👩‍👧',
    bg: colors.accentLight,
    title: 'Set up your\nfamily group',
    sub: 'Track finances together with your partner or family. You can always do this later.',
  },
  create: {
    emoji: '✨',
    bg: '#FFF8E6',
    title: 'Name your\nfamily',
    sub: 'Give your group a name. Your partner can join using your invite code.',
  },
  join: {
    emoji: '🔗',
    bg: '#EEF2FF',
    title: 'Join a family',
    sub: 'Enter the 8-character invite code from your family admin.',
  },
  'join-pending': {
    emoji: '✅',
    bg: '#E6F4EC',
    title: 'Request sent!',
    sub: 'The family admin will review and approve your request.',
  },
};

export default function OnboardingScreen() {
  const colors = useColors();
  const styles = useMemo(() => makeStyles(colors), [colors]);
  const { user } = useAuth();
  const { createFamily, joinFamily } = useFamily();
  const insets = useSafeAreaInsets();
  const [step, setStep] = useState<Step>('choice');
  const [familyName, setFamilyName] = useState('');
  const [inviteCode, setInviteCode] = useState('');
  const [joinedFamilyName, setJoinedFamilyName] = useState('');
  const [error, setError] = useState('');
  const [submitting, setSubmitting] = useState(false);

  async function handleCreate() {
    if (!familyName.trim()) { setError('Family name is required'); return; }
    setError(''); setSubmitting(true);
    try {
      await createFamily(familyName.trim());
      router.replace('/(tabs)');
    } catch (err) {
      setError(err instanceof ApiError ? err.message : 'Something went wrong');
    } finally {
      setSubmitting(false);
    }
  }

  async function handleJoin() {
    if (!inviteCode.trim()) { setError('Invite code is required'); return; }
    setError(''); setSubmitting(true);
    try {
      const name = await joinFamily(inviteCode.trim().toUpperCase());
      setJoinedFamilyName(name);
      setStep('join-pending');
    } catch (err) {
      setError(err instanceof ApiError ? err.message : 'Something went wrong');
    } finally {
      setSubmitting(false);
    }
  }

  const meta = STEP_META[step];

  return (
    <KeyboardAvoidingView style={styles.root} behavior={Platform.OS === 'ios' ? 'padding' : undefined}>
      <ScrollView
        contentContainerStyle={[styles.content, { paddingTop: insets.top + spacing.xl, paddingBottom: insets.bottom + spacing.xl }]}
        keyboardShouldPersistTaps="handled"
        showsVerticalScrollIndicator={false}>

        {/* Illustration */}
        <View style={styles.illustrationWrap}>
          <View style={[styles.illustrationBg, { backgroundColor: meta.bg }]}>
            <Text style={styles.illustrationEmoji}>{meta.emoji}</Text>
          </View>
          <Text style={styles.wordmark}>Nestworth</Text>
        </View>

        {/* Greeting */}
        {step === 'choice' && user?.displayName && (
          <Text style={styles.greeting}>Hi, {user.displayName} 👋</Text>
        )}

        {/* Heading */}
        <Text style={styles.title}>{meta.title}</Text>
        <Text style={styles.sub}>{meta.sub}</Text>

        {/* Step content */}
        {step === 'choice' && (
          <View style={styles.choiceGrid}>
            <Pressable
              onPress={() => { setStep('create'); setError(''); }}
              style={({ pressed }) => [styles.choiceCard, pressed && { opacity: 0.88 }]}>
              <View style={styles.choiceIconWrap}>
                <Text style={styles.choiceCardIcon}>✨</Text>
              </View>
              <Text style={styles.choiceCardLabel}>Create a new family</Text>
              <Text style={styles.choiceCardDesc}>Start fresh — invite your partner later</Text>
            </Pressable>

            <Pressable
              onPress={() => { setStep('join'); setError(''); }}
              style={({ pressed }) => [styles.choiceCard, pressed && { opacity: 0.88 }]}>
              <View style={[styles.choiceIconWrap, { backgroundColor: '#EEF2FF' }]}>
                <Text style={styles.choiceCardIcon}>🔗</Text>
              </View>
              <Text style={styles.choiceCardLabel}>Join an existing family</Text>
              <Text style={styles.choiceCardDesc}>Enter an invite code from your admin</Text>
            </Pressable>

            <Pressable
              onPress={() => router.replace('/(tabs)')}
              style={({ pressed }) => [styles.skipBtn, pressed && { opacity: 0.7 }]}>
              <Text style={styles.skipBtnText}>Skip for now</Text>
            </Pressable>
          </View>
        )}

        {step === 'create' && (
          <View style={styles.formCard}>
            <Input
              label="Family name"
              value={familyName}
              onChangeText={setFamilyName}
              autoCapitalize="words"
              placeholder='e.g. "The Tans" or "Alex & Jordan"'
              onSubmitEditing={handleCreate}
            />
            {error ? <Text style={styles.error}>{error}</Text> : null}
            <Pressable
              onPress={handleCreate}
              style={({ pressed }) => [styles.primaryBtn, pressed && { opacity: 0.88 }]}>
              {submitting
                ? <ActivityIndicator color="#fff" size="small" />
                : <Text style={styles.primaryBtnText}>Create family</Text>}
            </Pressable>
            <Pressable onPress={() => { setStep('choice'); setError(''); }} style={styles.backLink}>
              <Text style={styles.backLinkText}>← Back</Text>
            </Pressable>
          </View>
        )}

        {step === 'join' && (
          <View style={styles.formCard}>
            <Input
              label="Invite code"
              value={inviteCode}
              onChangeText={(t) => setInviteCode(t.toUpperCase())}
              autoCapitalize="characters"
              autoCorrect={false}
              placeholder="e.g. A3F9C201"
              onSubmitEditing={handleJoin}
            />
            {error ? <Text style={styles.error}>{error}</Text> : null}
            <Pressable
              onPress={handleJoin}
              style={({ pressed }) => [styles.primaryBtn, pressed && { opacity: 0.88 }]}>
              {submitting
                ? <ActivityIndicator color="#fff" size="small" />
                : <Text style={styles.primaryBtnText}>Send join request</Text>}
            </Pressable>
            <Pressable onPress={() => { setStep('choice'); setError(''); }} style={styles.backLink}>
              <Text style={styles.backLinkText}>← Back</Text>
            </Pressable>
          </View>
        )}

        {step === 'join-pending' && (
          <View style={styles.successCard}>
            <Text style={styles.successText}>
              Your request to join{' '}
              <Text style={styles.successFamilyName}>{joinedFamilyName}</Text>
              {' '}has been sent. You'll get access once the admin approves it.
            </Text>
            <Pressable
              onPress={() => router.replace('/(tabs)')}
              style={({ pressed }) => [styles.primaryBtn, pressed && { opacity: 0.88 }]}>
              <Text style={styles.primaryBtnText}>Continue to app</Text>
            </Pressable>
          </View>
        )}
      </ScrollView>
    </KeyboardAvoidingView>
  );
}

function makeStyles(colors: Colors) { return StyleSheet.create({
  root: { flex: 1, backgroundColor: colors.surface },
  content: { paddingHorizontal: spacing.lg, alignItems: 'center' },

  illustrationWrap: { alignItems: 'center', marginBottom: spacing.sm },
  illustrationBg: {
    width: 120,
    height: 120,
    borderRadius: 60,
    alignItems: 'center',
    justifyContent: 'center',
    marginBottom: spacing.sm,
  },
  illustrationEmoji: { fontSize: 56 },
  wordmark: {
    fontSize: 13,
    fontFamily: 'Inter_600SemiBold',
    fontWeight: '600',
    color: colors.textMuted,
    letterSpacing: 1.5,
    textTransform: 'uppercase',
    marginBottom: spacing.sm,
  },

  greeting: {
    ...typography.caption,
    color: colors.textMuted,
    marginBottom: spacing.xs,
    textAlign: 'center',
  },
  title: {
    fontSize: 30,
    fontWeight: '700',
    fontFamily: 'Inter_600SemiBold',
    color: colors.text,
    letterSpacing: -0.6,
    textAlign: 'center',
    marginBottom: spacing.sm,
    lineHeight: 36,
  },
  sub: {
    ...typography.body,
    color: colors.textSecondary,
    textAlign: 'center',
    marginBottom: spacing.xl,
    lineHeight: 22,
    paddingHorizontal: spacing.sm,
  },

  // Choice cards
  choiceGrid: { width: '100%', gap: spacing.md },
  choiceCard: {
    backgroundColor: colors.background,
    borderRadius: radius.lg,
    padding: spacing.lg,
    borderWidth: 1.5,
    borderColor: colors.borderLight,
    ...shadow.card,
  },
  choiceIconWrap: {
    width: 44,
    height: 44,
    borderRadius: 22,
    backgroundColor: colors.accentLight,
    alignItems: 'center',
    justifyContent: 'center',
    marginBottom: spacing.sm,
  },
  choiceCardIcon: { fontSize: 22 },
  choiceCardLabel: {
    ...typography.bodyMedium,
    color: colors.text,
    marginBottom: 3,
  },
  choiceCardDesc: {
    ...typography.caption,
    color: colors.textSecondary,
  },
  skipBtn: {
    alignItems: 'center',
    paddingVertical: spacing.md,
  },
  skipBtnText: {
    ...typography.body,
    color: colors.textMuted,
  },

  // Form
  formCard: {
    width: '100%',
    backgroundColor: colors.background,
    borderRadius: radius.lg,
    padding: spacing.lg,
    borderWidth: 1,
    borderColor: colors.borderLight,
    marginBottom: spacing.lg,
  },

  // Success
  successCard: {
    width: '100%',
    backgroundColor: colors.positiveLight,
    borderRadius: radius.lg,
    padding: spacing.lg,
    borderWidth: 1,
    borderColor: '#C3E6CF',
    gap: spacing.md,
  },
  successText: {
    ...typography.body,
    color: colors.text,
    lineHeight: 22,
    textAlign: 'center',
  },
  successFamilyName: {
    fontFamily: 'Inter_600SemiBold',
    fontWeight: '600',
  },

  error: {
    ...typography.caption,
    color: colors.negative,
    backgroundColor: colors.negativeLight,
    borderRadius: radius.sm,
    padding: spacing.sm,
    marginBottom: spacing.md,
    overflow: 'hidden',
    textAlign: 'center',
  },

  primaryBtn: {
    backgroundColor: colors.text,
    borderRadius: 99,
    paddingVertical: 15,
    alignItems: 'center',
    marginTop: spacing.sm,
    ...shadow.card,
  },
  primaryBtnText: {
    fontSize: 16,
    fontFamily: 'Inter_600SemiBold',
    fontWeight: '600',
    color: '#FFFFFF',
    letterSpacing: -0.2,
  },

  backLink: { marginTop: spacing.md, alignItems: 'center', paddingVertical: spacing.sm },
  backLinkText: { ...typography.caption, color: colors.textMuted },
}); }
