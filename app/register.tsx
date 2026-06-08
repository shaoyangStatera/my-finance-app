import { ApiError, useAuth } from '@/contexts/AuthContext';
import { Button, Input } from '@/components/ui';
import { useColors } from '@/contexts/ThemeContext';
import { type Colors, radius, shadow, spacing, typography } from '@/lib/design-tokens';
import { PENDING_OTP_TIMEOUT_MS } from '@/lib/session-config';
import { router } from 'expo-router';
import { useEffect, useMemo, useRef, useState } from 'react';
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

type Step = 'form' | 'verify';

export default function RegisterScreen() {
  const colors = useColors();
  const styles = useMemo(() => makeStyles(colors), [colors]);
  const { register, verifyEmail } = useAuth();
  const insets = useSafeAreaInsets();
  const [step, setStep] = useState<Step>('form');
  const [email, setEmail] = useState('');
  const [displayName, setDisplayName] = useState('');
  const [password, setPassword] = useState('');
  const [confirmPassword, setConfirmPassword] = useState('');
  const [code, setCode] = useState('');
  const [pendingToken, setPendingToken] = useState('');
  const [error, setError] = useState('');
  const [submitting, setSubmitting] = useState(false);
  const [pendingExpiresAt, setPendingExpiresAt] = useState<number | null>(null);
  const timeoutRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  useEffect(() => () => { if (timeoutRef.current) clearTimeout(timeoutRef.current); }, []);

  useEffect(() => {
    if (!pendingExpiresAt) return;
    const tick = setInterval(() => {
      if (Date.now() >= pendingExpiresAt) {
        setStep('form');
        setError('Verification timed out. Please try again.');
        setPendingExpiresAt(null);
      }
    }, 1000);
    return () => clearInterval(tick);
  }, [pendingExpiresAt]);

  function startTimeout() {
    const expiresAt = Date.now() + PENDING_OTP_TIMEOUT_MS;
    setPendingExpiresAt(expiresAt);
    if (timeoutRef.current) clearTimeout(timeoutRef.current);
    timeoutRef.current = setTimeout(() => {
      setStep('form');
      setError('Verification timed out. Please try again.');
    }, PENDING_OTP_TIMEOUT_MS);
  }

  async function handleRegister() {
    if (!displayName.trim()) { setError('Display name is required'); return; }
    if (!email.trim()) { setError('Email is required'); return; }
    if (password.length < 12) { setError('Password must be at least 12 characters'); return; }
    if (!/[a-zA-Z]/.test(password)) { setError('Password must contain at least one letter'); return; }
    if (!/[0-9]/.test(password)) { setError('Password must contain at least one number'); return; }
    if (!/[^a-zA-Z0-9]/.test(password)) { setError('Password must contain at least one special character (e.g. !@#$%)'); return; }
    if (password !== confirmPassword) { setError('Passwords do not match'); return; }
    setError('');
    setSubmitting(true);
    try {
      const result = await register(email.trim(), password, displayName.trim());
      setPendingToken(result.pendingToken);
      setStep('verify');
      startTimeout();
    } catch (err) {
      setError(err instanceof ApiError ? err.message : 'Could not connect. Is the API running?');
    } finally {
      setSubmitting(false);
    }
  }

  async function handleVerify() {
    if (code.length !== 6) { setError('Enter the 6-digit code from your email'); return; }
    setError('');
    setSubmitting(true);
    try {
      await verifyEmail(pendingToken, code.trim());
      router.replace('/onboarding');
    } catch (err) {
      setError(err instanceof ApiError ? err.message : 'Could not connect. Is the API running?');
    } finally {
      setSubmitting(false);
    }
  }

  const secondsLeft = pendingExpiresAt
    ? Math.max(0, Math.ceil((pendingExpiresAt - Date.now()) / 1000))
    : null;

  return (
    <KeyboardAvoidingView style={styles.root} behavior={Platform.OS === 'ios' ? 'padding' : undefined}>
      <ScrollView
        contentContainerStyle={[styles.content, { paddingTop: insets.top + spacing.xl, paddingBottom: insets.bottom + spacing.xl }]}
        keyboardShouldPersistTaps="handled"
        showsVerticalScrollIndicator={false}>

        {/* Illustration */}
        <View style={styles.illustrationWrap}>
          <View style={[styles.illustrationBg, step === 'verify' ? styles.illustrationBgVerify : null]}>
            <Text style={styles.illustrationEmoji}>{step === 'form' ? '✨' : '📧'}</Text>
          </View>
          <Text style={styles.wordmark}>Nestworth</Text>
        </View>

        {/* Heading */}
        <Text style={styles.title}>
          {step === 'form' ? 'Create your\naccount' : 'Verify your\nemail'}
        </Text>
        <Text style={styles.sub}>
          {step === 'form'
            ? 'Start tracking your family finances today.'
            : `We sent a 6-digit code to\n${email}`}
        </Text>

        {/* Form card */}
        <View style={styles.card}>
          {step === 'form' && (
            <>
              <Input
                label="Your name"
                value={displayName}
                onChangeText={setDisplayName}
                autoCapitalize="words"
                placeholder="e.g. Alex"
                returnKeyType="next"
              />
              <Input
                label="Email"
                value={email}
                onChangeText={setEmail}
                autoCapitalize="none"
                keyboardType="email-address"
                autoComplete="email"
                returnKeyType="next"
              />
              <Input
                label="Password"
                value={password}
                onChangeText={setPassword}
                secureTextEntry
                returnKeyType="next"
              />
              <Input
                label="Confirm password"
                value={confirmPassword}
                onChangeText={setConfirmPassword}
                secureTextEntry
                returnKeyType="done"
                onSubmitEditing={handleRegister}
              />
              <Text style={styles.hint}>Min 12 characters with letters, numbers and a special character (e.g. !@#$%).</Text>
              {error ? <Text style={styles.error}>{error}</Text> : null}
              <Pressable
                onPress={handleRegister}
                style={({ pressed }) => [styles.primaryBtn, pressed && { opacity: 0.88 }]}>
                {submitting
                  ? <ActivityIndicator color="#fff" size="small" />
                  : <Text style={styles.primaryBtnText}>Create account</Text>}
              </Pressable>
            </>
          )}

          {step === 'verify' && (
            <>
              <Text style={styles.stepHint}>Enter the code from your email to verify your account.</Text>
              <Input
                label="6-digit code"
                value={code}
                onChangeText={(t) => setCode(t.replace(/\D/g, '').slice(0, 6))}
                keyboardType="number-pad"
                autoComplete="one-time-code"
                maxLength={6}
              />
              {secondsLeft !== null && (
                <Text style={styles.timer}>Code expires in {secondsLeft}s</Text>
              )}
              {error ? <Text style={styles.error}>{error}</Text> : null}
              <Pressable
                onPress={handleVerify}
                style={({ pressed }) => [styles.primaryBtn, pressed && { opacity: 0.88 }]}>
                {submitting
                  ? <ActivityIndicator color="#fff" size="small" />
                  : <Text style={styles.primaryBtnText}>Verify email</Text>}
              </Pressable>
              <Pressable onPress={() => { setStep('form'); setCode(''); setError(''); }} style={styles.backLink}>
                <Text style={styles.backLinkText}>← Back</Text>
              </Pressable>
            </>
          )}
        </View>

        {/* Bottom CTA */}
        {step === 'form' && (
          <View style={styles.bottomRow}>
            <Text style={styles.bottomText}>Already have an account?</Text>
            <Pressable onPress={() => router.push('/login')}>
              <Text style={styles.bottomLink}> Sign in</Text>
            </Pressable>
          </View>
        )}

        <Text style={styles.fine}>
          By creating an account you agree to our Terms of Service and Privacy Policy.
        </Text>
      </ScrollView>
    </KeyboardAvoidingView>
  );
}

function makeStyles(colors: Colors) { return StyleSheet.create({
  root: { flex: 1, backgroundColor: colors.surface },
  content: { paddingHorizontal: spacing.lg, alignItems: 'center' },

  illustrationWrap: { alignItems: 'center', marginBottom: spacing.lg },
  illustrationBg: {
    width: 120,
    height: 120,
    borderRadius: 60,
    backgroundColor: colors.accentLight,
    alignItems: 'center',
    justifyContent: 'center',
    marginBottom: spacing.sm,
  },
  illustrationBgVerify: { backgroundColor: '#EEF2FF' },
  illustrationEmoji: { fontSize: 56 },
  wordmark: {
    fontSize: 13,
    fontFamily: 'Inter_600SemiBold',
    fontWeight: '600',
    color: colors.textMuted,
    letterSpacing: 1.5,
    textTransform: 'uppercase',
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
  },

  card: {
    width: '100%',
    backgroundColor: colors.background,
    borderRadius: radius.lg,
    padding: spacing.lg,
    borderWidth: 1,
    borderColor: colors.borderLight,
    marginBottom: spacing.lg,
  },

  hint: {
    ...typography.caption,
    color: colors.textMuted,
    marginBottom: spacing.md,
    lineHeight: 18,
  },
  stepHint: {
    ...typography.caption,
    color: colors.textSecondary,
    marginBottom: spacing.md,
    lineHeight: 20,
    textAlign: 'center',
  },
  timer: {
    ...typography.caption,
    color: colors.textMuted,
    marginBottom: spacing.md,
    textAlign: 'center',
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

  bottomRow: { flexDirection: 'row', alignItems: 'center', marginBottom: spacing.md },
  bottomText: { ...typography.caption, color: colors.textSecondary },
  bottomLink: { ...typography.caption, color: colors.accent, fontFamily: 'Inter_600SemiBold', fontWeight: '600' },

  fine: {
    ...typography.caption,
    color: colors.textMuted,
    textAlign: 'center',
    lineHeight: 18,
    paddingHorizontal: spacing.lg,
  },
}); }
