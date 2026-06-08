import { Input } from "@/components/ui";
import { ApiError, useAuth } from "@/contexts/AuthContext";
import { useColors } from '@/contexts/ThemeContext';
import {
  type Colors,
  radius,
  shadow,
  spacing,
  typography,
} from "@/lib/design-tokens";
import { PENDING_OTP_TIMEOUT_MS } from "@/lib/session-config";
import { Redirect, router } from "expo-router";
import { useEffect, useRef, useState } from "react";
import {
  ActivityIndicator,
  KeyboardAvoidingView,
  Platform,
  Pressable,
  ScrollView,
  StyleSheet,
  Text,
  View,
} from "react-native";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import { useMemo } from "react";

type Step = "credentials" | "reset";

const STEP_ILLUSTRATION: Record<
  Step,
  { emoji: string; bg: string; title: string; sub: string }
> = {
  credentials: {
    emoji: "🔐",
    bg: colors.accentLight,
    title: "Welcome back",
    sub: "Sign in to your Nestworth account.",
  },
  reset: {
    emoji: "🔑",
    bg: "#FDF5E6",
    title: "Set new password",
    sub: "Your password has expired. Choose a new one.",
  },
};

export default function LoginScreen() {
  const colors = useColors();
  const styles = useMemo(() => makeStyles(colors), [colors]);
  const {
    login,
    resetPassword,
    continueAsGuest,
    isAuthenticated,
    isLoading,
    user,
  } = useAuth();
  const insets = useSafeAreaInsets();
  const [step, setStep] = useState<Step>("credentials");
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [code, setCode] = useState("");
  const [newPassword, setNewPassword] = useState("");
  const [confirmPassword, setConfirmPassword] = useState("");
  const [pendingToken, setPendingToken] = useState("");
  const [info, setInfo] = useState("");
  const [error, setError] = useState("");
  const [submitting, setSubmitting] = useState(false);
  const [pendingExpiresAt, setPendingExpiresAt] = useState<number | null>(null);
  const timeoutRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  useEffect(() => {
    return () => {
      if (timeoutRef.current) clearTimeout(timeoutRef.current);
    };
  }, []);

  useEffect(() => {
    if (!pendingExpiresAt) return;
    const tick = setInterval(() => {
      if (Date.now() >= pendingExpiresAt)
        resetToCredentials("Verification timed out. Please sign in again.");
    }, 1000);
    return () => clearInterval(tick);
  }, [pendingExpiresAt]);

  if (!isLoading && isAuthenticated) {
    if (!user?.onboardingComplete) return <Redirect href="/onboarding" />;
    return <Redirect href="/(tabs)" />;
  }

  if (isLoading) {
    return (
      <View style={styles.loading}>
        <ActivityIndicator color={colors.accent} size="large" />
      </View>
    );
  }

  function resetToCredentials(message?: string) {
    setStep("credentials");
    setCode("");
    setNewPassword("");
    setConfirmPassword("");
    setPendingToken("");
    setPendingExpiresAt(null);
    setInfo("");
    if (timeoutRef.current) {
      clearTimeout(timeoutRef.current);
      timeoutRef.current = null;
    }
    if (message) setError(message);
  }

  function startPendingTimeout() {
    const expiresAt = Date.now() + PENDING_OTP_TIMEOUT_MS;
    setPendingExpiresAt(expiresAt);
    if (timeoutRef.current) clearTimeout(timeoutRef.current);
    timeoutRef.current = setTimeout(
      () => resetToCredentials("Verification timed out. Please sign in again."),
      PENDING_OTP_TIMEOUT_MS,
    );
  }

  function formatRetryMessage(err: ApiError): string {
    if (err.retryAfterSeconds) {
      return `${err.message} (${Math.ceil(err.retryAfterSeconds / 60)} min)`;
    }
    return err.message;
  }

  async function handleCredentials() {
    setError("");
    setInfo("");
    setSubmitting(true);
    try {
      const result = await login(email.trim(), password);
      if ("loggedIn" in result) {
        // Auth context already saved the token and set user — navigation handled by redirect
        return;
      }
      // Password expired — show reset step
      setPendingToken(result.pendingToken);
      setStep("reset");
      setInfo(result.message);
      startPendingTimeout();
    } catch (err) {
      setError(
        err instanceof ApiError
          ? formatRetryMessage(err)
          : "Could not connect. Is the API running?",
      );
    } finally {
      setSubmitting(false);
    }
  }

  async function handleResetPassword() {
    if (code.length !== 6) {
      setError("Enter the 6-digit code from your email.");
      return;
    }
    if (newPassword.length < 12) {
      setError("New password must be at least 12 characters.");
      return;
    }
    if (!/[a-zA-Z]/.test(newPassword)) {
      setError("Password must contain at least one letter.");
      return;
    }
    if (!/[0-9]/.test(newPassword)) {
      setError("Password must contain at least one number.");
      return;
    }
    if (!/[^a-zA-Z0-9]/.test(newPassword)) {
      setError(
        "Password must contain at least one special character (e.g. !@#$%).",
      );
      return;
    }
    if (newPassword !== confirmPassword) {
      setError("Passwords do not match.");
      return;
    }
    setError("");
    setSubmitting(true);
    try {
      await resetPassword(pendingToken, code.trim(), newPassword);
    } catch (err) {
      if (err instanceof ApiError) {
        setError(formatRetryMessage(err));
        if (err.status === 401 && err.message.includes("expired"))
          resetToCredentials(err.message);
      } else {
        setError("Could not connect. Is the API running?");
      }
    } finally {
      setSubmitting(false);
    }
  }

  const pendingSecondsLeft = pendingExpiresAt
    ? Math.max(0, Math.ceil((pendingExpiresAt - Date.now()) / 1000))
    : null;

  const illus = STEP_ILLUSTRATION[step];

  return (
    <KeyboardAvoidingView
      style={styles.root}
      behavior={Platform.OS === "ios" ? "padding" : undefined}
    >
      <ScrollView
        contentContainerStyle={[
          styles.content,
          {
            paddingTop: insets.top + spacing.xl,
            paddingBottom: insets.bottom + spacing.xl,
          },
        ]}
        keyboardShouldPersistTaps="handled"
        showsVerticalScrollIndicator={false}
      >
        {/* Illustration */}
        <View style={styles.illustrationWrap}>
          <View style={[styles.illustrationBg, { backgroundColor: illus.bg }]}>
            <Text style={styles.illustrationEmoji}>{illus.emoji}</Text>
          </View>
          {/* Nestworth wordmark */}
          <Text style={styles.wordmark}>Nestworth</Text>
        </View>

        {/* Heading */}
        <Text style={styles.title}>{illus.title}</Text>
        <Text style={styles.sub}>{illus.sub}</Text>

        {/* Form card */}
        <View style={styles.card}>
          {step === "credentials" && (
            <>
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
                returnKeyType="done"
                onSubmitEditing={handleCredentials}
              />
              {error ? <Text style={styles.error}>{error}</Text> : null}
              <Pressable
                onPress={handleCredentials}
                style={({ pressed }) => [
                  styles.primaryBtn,
                  pressed && { opacity: 0.88 },
                ]}
              >
                {submitting ? (
                  <ActivityIndicator color="#fff" size="small" />
                ) : (
                  <Text style={styles.primaryBtnText}>Login</Text>
                )}
              </Pressable>
            </>
          )}

          {step === "reset" && (
            <>
              {info ? <Text style={styles.stepHint}>{info}</Text> : null}
              <Input
                label="6-digit code"
                value={code}
                onChangeText={(t) => setCode(t.replace(/\D/g, "").slice(0, 6))}
                keyboardType="number-pad"
                autoComplete="one-time-code"
                maxLength={6}
              />
              <Input
                label="New password"
                value={newPassword}
                onChangeText={setNewPassword}
                secureTextEntry
              />
              <Input
                label="Confirm password"
                value={confirmPassword}
                onChangeText={setConfirmPassword}
                secureTextEntry
              />
              {pendingSecondsLeft !== null && (
                <Text style={styles.timer}>
                  Code expires in {pendingSecondsLeft}s
                </Text>
              )}
              {error ? <Text style={styles.error}>{error}</Text> : null}
              <Pressable
                onPress={handleResetPassword}
                style={({ pressed }) => [
                  styles.primaryBtn,
                  pressed && { opacity: 0.88 },
                ]}
              >
                {submitting ? (
                  <ActivityIndicator color="#fff" size="small" />
                ) : (
                  <Text style={styles.primaryBtnText}>
                    Update password & sign in
                  </Text>
                )}
              </Pressable>
              <Pressable
                onPress={() => resetToCredentials()}
                style={styles.backLink}
              >
                <Text style={styles.backLinkText}>← Back to sign in</Text>
              </Pressable>
            </>
          )}
        </View>

        {/* Bottom CTAs */}
        {step === "credentials" && (
          <>
            <View style={styles.bottomRow}>
              <Text style={styles.bottomText}>Don't have an account?</Text>
              <Pressable onPress={() => router.push("/register")}>
                <Text style={styles.bottomLink}> Create one</Text>
              </Pressable>
            </View>

            <View style={styles.dividerRow}>
              <View style={styles.dividerLine} />
              <Text style={styles.dividerText}>or</Text>
              <View style={styles.dividerLine} />
            </View>

            <Pressable
              onPress={() => {
                continueAsGuest();
                router.replace("/(tabs)");
              }}
              style={({ pressed }) => [
                styles.guestBtn,
                pressed && { opacity: 0.7 },
              ]}
            >
              <Text style={styles.guestBtnText}>Continue as guest</Text>
            </Pressable>
            <Text style={styles.guestHint}>
              Data won't be saved · Family groups unavailable
            </Text>
          </>
        )}
      </ScrollView>
    </KeyboardAvoidingView>
  );
}

function makeStyles(colors: Colors) { return StyleSheet.create({
  root: { flex: 1, backgroundColor: colors.surface },
  loading: {
    flex: 1,
    alignItems: "center",
    justifyContent: "center",
    backgroundColor: colors.surface,
  },
  content: { paddingHorizontal: spacing.lg, alignItems: "center" },

  illustrationWrap: { alignItems: "center", marginBottom: spacing.lg },
  illustrationBg: {
    width: 120,
    height: 120,
    borderRadius: 60,
    alignItems: "center",
    justifyContent: "center",
    marginBottom: spacing.sm,
  },
  illustrationEmoji: { fontSize: 56 },
  wordmark: {
    fontSize: 13,
    fontFamily: "Inter_600SemiBold",
    fontWeight: "600",
    color: colors.textMuted,
    letterSpacing: 1.5,
    textTransform: "uppercase",
  },

  title: {
    fontSize: 30,
    fontWeight: "700",
    fontFamily: "Inter_600SemiBold",
    color: colors.text,
    letterSpacing: -0.6,
    textAlign: "center",
    marginBottom: spacing.sm,
  },
  sub: {
    ...typography.body,
    color: colors.textSecondary,
    textAlign: "center",
    marginBottom: spacing.xl,
  },

  card: {
    width: "100%",
    backgroundColor: colors.background,
    borderRadius: radius.lg,
    padding: spacing.lg,
    borderWidth: 1,
    borderColor: colors.borderLight,
    marginBottom: spacing.lg,
  },

  stepHint: {
    ...typography.caption,
    color: colors.textSecondary,
    marginBottom: spacing.md,
    lineHeight: 20,
    textAlign: "center",
  },
  timer: {
    ...typography.caption,
    color: colors.textMuted,
    marginBottom: spacing.md,
    textAlign: "center",
  },
  error: {
    ...typography.caption,
    color: colors.negative,
    backgroundColor: colors.negativeLight,
    borderRadius: radius.sm,
    padding: spacing.sm,
    marginBottom: spacing.md,
    overflow: "hidden",
    textAlign: "center",
  },

  primaryBtn: {
    backgroundColor: colors.text,
    borderRadius: 99,
    paddingVertical: 15,
    alignItems: "center",
    marginTop: spacing.sm,
    ...shadow.card,
  },
  primaryBtnText: {
    fontSize: 16,
    fontFamily: "Inter_600SemiBold",
    fontWeight: "600",
    color: "#FFFFFF",
    letterSpacing: -0.2,
  },

  backLink: {
    marginTop: spacing.md,
    alignItems: "center",
    paddingVertical: spacing.sm,
  },
  backLinkText: { ...typography.caption, color: colors.textMuted },

  bottomRow: {
    flexDirection: "row",
    alignItems: "center",
    marginTop: spacing.sm,
  },
  bottomText: { ...typography.caption, color: colors.textSecondary },
  bottomLink: {
    ...typography.caption,
    color: colors.accent,
    fontFamily: "Inter_600SemiBold",
    fontWeight: "600",
  },

  dividerRow: {
    flexDirection: "row",
    alignItems: "center",
    gap: spacing.sm,
    marginVertical: spacing.md,
    width: "100%",
  },
  dividerLine: { flex: 1, height: 1, backgroundColor: colors.border },
  dividerText: { ...typography.caption, color: colors.textMuted },

  guestBtn: {
    width: "100%",
    borderRadius: 99,
    paddingVertical: 15,
    alignItems: "center",
    backgroundColor: colors.background,
    borderWidth: 1.5,
    borderColor: colors.border,
  },
  guestBtnText: {
    fontSize: 16,
    fontFamily: "Inter_500Medium",
    fontWeight: "500",
    color: colors.textSecondary,
    letterSpacing: -0.2,
  },
  guestHint: {
    ...typography.caption,
    color: colors.textMuted,
    textAlign: "center",
    marginTop: spacing.sm,
  },
}); }
