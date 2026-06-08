import { useColors } from '@/contexts/ThemeContext';
import { layout, radius, shadow, spacing, typography, type Colors } from '@/lib/design-tokens';
import { ReactNode, useMemo } from 'react';
import {
  ActivityIndicator,
  KeyboardAvoidingView,
  Platform,
  Pressable,
  ScrollView,
  StyleSheet,
  Text,
  TextInput,
  TextInputProps,
  View,
  ViewStyle,
} from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

interface ScreenProps {
  children: ReactNode;
  scroll?: boolean;
  style?: ViewStyle;
}

export function Screen({ children, scroll = true, style }: ScreenProps) {
  const insets = useSafeAreaInsets();
  const colors = useColors();
  const content = scroll ? (
    <ScrollView
      contentContainerStyle={[staticStyles.scrollContent, style]}
      keyboardShouldPersistTaps="handled"
      showsVerticalScrollIndicator={false}>
      {children}
    </ScrollView>
  ) : (
    <View style={[staticStyles.scrollContent, style]}>{children}</View>
  );

  return (
    <KeyboardAvoidingView
      style={[staticStyles.screen, { paddingTop: insets.top, backgroundColor: colors.background }]}
      behavior={Platform.OS === 'ios' ? 'padding' : undefined}>
      {content}
    </KeyboardAvoidingView>
  );
}

interface CardProps {
  children: ReactNode;
  style?: ViewStyle;
  elevated?: boolean;
  tinted?: boolean;
}

export function Card({ children, style, elevated, tinted }: CardProps) {
  const colors = useColors();
  return (
    <View
      style={[
        staticStyles.card,
        {
          backgroundColor: tinted ? colors.accentLight : colors.surface,
          borderColor: tinted ? colors.accent + '44' : colors.border,
        },
        elevated && staticStyles.cardElevated,
        style,
      ]}>
      {children}
    </View>
  );
}

interface StatProps {
  label: string;
  value: string;
  hint?: string;
  tone?: 'default' | 'positive' | 'negative' | 'warning';
  large?: boolean;
}

export function Stat({ label, value, hint, tone = 'default', large }: StatProps) {
  const colors = useColors();
  const valueColor =
    tone === 'positive' ? colors.positive
    : tone === 'negative' ? colors.negative
    : tone === 'warning' ? colors.warning
    : colors.text;

  const bgColor =
    tone === 'positive' ? colors.positiveLight
    : tone === 'negative' ? colors.negativeLight
    : tone === 'warning' ? colors.warningLight
    : undefined;

  return (
    <View style={[staticStyles.statContainer, bgColor ? { backgroundColor: bgColor, borderRadius: radius.sm, padding: spacing.md } : undefined]}>
      <Text style={[staticStyles.statLabel, { color: colors.textMuted }]}>{label}</Text>
      <Text style={[staticStyles.statValue, large && staticStyles.statValueLarge, { color: valueColor }]}>
        {value}
      </Text>
      {hint ? <Text style={[staticStyles.statHint, { color: colors.textSecondary }]}>{hint}</Text> : null}
    </View>
  );
}

interface SectionHeaderProps {
  title: string;
  subtitle?: string;
}

export function SectionHeader({ title, subtitle }: SectionHeaderProps) {
  const colors = useColors();
  return (
    <View style={staticStyles.sectionHeader}>
      <Text style={[staticStyles.sectionTitle, { color: colors.text }]}>{title}</Text>
      {subtitle ? <Text style={[staticStyles.sectionSubtitle, { color: colors.textSecondary }]}>{subtitle}</Text> : null}
    </View>
  );
}

interface BadgeProps {
  label: string;
  tone?: 'accent' | 'positive' | 'negative' | 'warning' | 'neutral';
}

export function Badge({ label, tone = 'neutral' }: BadgeProps) {
  const colors = useColors();
  const badgeBg =
    tone === 'accent'   ? colors.accentLight
    : tone === 'positive' ? colors.positiveLight
    : tone === 'negative' ? colors.negativeLight
    : tone === 'warning'  ? colors.warningLight
    : colors.borderLight;
  const badgeText =
    tone === 'accent'   ? colors.accent
    : tone === 'positive' ? colors.positive
    : tone === 'negative' ? colors.negative
    : tone === 'warning'  ? colors.warning
    : colors.textSecondary;

  return (
    <View style={[staticStyles.badge, { backgroundColor: badgeBg }]}>
      <Text style={[staticStyles.badgeText, { color: badgeText }]}>{label}</Text>
    </View>
  );
}

interface ButtonProps {
  label: string;
  onPress: () => void;
  variant?: 'primary' | 'secondary' | 'ghost' | 'danger';
  disabled?: boolean;
  loading?: boolean;
}

export function Button({
  label,
  onPress,
  variant = 'primary',
  disabled = false,
  loading = false,
}: ButtonProps) {
  const colors = useColors();
  const styles = useMemo(() => makeButtonStyles(colors), [colors]);
  return (
    <Pressable
      onPress={onPress}
      disabled={disabled || loading}
      style={({ pressed }) => [
        staticStyles.button,
        variant === 'primary' && styles.buttonPrimary,
        variant === 'secondary' && styles.buttonSecondary,
        variant === 'ghost' && staticStyles.buttonGhost,
        variant === 'danger' && styles.buttonDanger,
        (disabled || loading) && staticStyles.buttonDisabled,
        pressed && !disabled && staticStyles.buttonPressed,
      ]}>
      {loading ? (
        <ActivityIndicator color={variant === 'primary' || variant === 'danger' ? '#fff' : colors.accent} />
      ) : (
        <Text
          style={[
            staticStyles.buttonLabel,
            (variant === 'primary' || variant === 'danger') && staticStyles.buttonLabelPrimary,
            (variant === 'secondary' || variant === 'ghost') && styles.buttonLabelSecondary,
          ]}>
          {label}
        </Text>
      )}
    </Pressable>
  );
}

function makeButtonStyles(colors: Colors) {
  return StyleSheet.create({
    buttonPrimary: { backgroundColor: colors.accent, ...shadow.card },
    buttonSecondary: { backgroundColor: colors.surface, borderWidth: 1.5, borderColor: colors.border },
    buttonDanger: { backgroundColor: colors.negative },
    buttonLabelSecondary: { color: colors.text },
  });
}

interface InputProps extends TextInputProps {
  label: string;
}

export function Input({ label, style, ...props }: InputProps) {
  const colors = useColors();
  return (
    <View style={staticStyles.inputGroup}>
      <Text style={[staticStyles.inputLabel, { color: colors.textMuted }]}>{label}</Text>
      <TextInput
        placeholderTextColor={colors.textMuted}
        style={[staticStyles.input, { color: colors.text, backgroundColor: colors.surface, borderColor: colors.border }, style]}
        {...props}
      />
    </View>
  );
}

interface MoneyInputProps extends Omit<InputProps, 'onChangeText' | 'value'> {
  value: number;
  onChangeValue?: (value: number) => void;
}

export function MoneyInput({ value, onChangeValue, ...props }: MoneyInputProps) {
  return (
    <Input
      {...props}
      value={value === 0 ? '' : String(value)}
      keyboardType="numeric"
      placeholder="0"
      editable={onChangeValue !== undefined && props.editable !== false}
      onChangeText={(text) => {
        if (!onChangeValue) return;
        const parsed = Number(text.replace(/[^0-9.]/g, ''));
        onChangeValue(Number.isNaN(parsed) ? 0 : parsed);
      }}
    />
  );
}

// ─── Static styles (layout / sizing only — no colors) ─────────────────────────
const staticStyles = StyleSheet.create({
  screen: { flex: 1 },
  scrollContent: {
    paddingHorizontal: spacing.md,
    paddingBottom: spacing.xxl + layout.tabBarHeight,
    maxWidth: layout.maxContentWidth,
    width: '100%',
    alignSelf: 'center',
  },
  card: {
    borderWidth: 1,
    borderRadius: radius.md,
    padding: spacing.lg,
    marginBottom: spacing.md,
    ...shadow.card,
  },
  cardElevated: { ...shadow.elevated, borderWidth: 0 },
  statContainer: { marginBottom: spacing.sm },
  statLabel: { ...typography.label, marginBottom: spacing.xs },
  statValue: { ...typography.stat },
  statValueLarge: { fontSize: 38, letterSpacing: -1 },
  statHint: { ...typography.caption, marginTop: spacing.xs },
  sectionHeader: { marginBottom: spacing.md, marginTop: spacing.sm },
  sectionTitle: { ...typography.title, fontSize: 22 },
  sectionSubtitle: { ...typography.caption, marginTop: spacing.xs },
  badge: { borderRadius: 99, paddingVertical: 3, paddingHorizontal: 10, alignSelf: 'flex-start' },
  badgeText: { fontSize: 11, fontWeight: '600', fontFamily: 'Inter_600SemiBold', letterSpacing: 0.3 },
  button: {
    borderRadius: radius.sm,
    paddingVertical: spacing.md,
    paddingHorizontal: spacing.lg,
    alignItems: 'center',
    justifyContent: 'center',
    minHeight: 50,
  },
  buttonGhost: { backgroundColor: 'transparent' },
  buttonDisabled: { opacity: 0.45 },
  buttonPressed: { opacity: 0.82, transform: [{ scale: 0.98 }] },
  buttonLabel: { ...typography.bodyMedium, fontSize: 15 },
  buttonLabelPrimary: { color: '#FFFFFF', fontFamily: 'Inter_600SemiBold', fontWeight: '600' },
  inputGroup: { marginBottom: spacing.md },
  inputLabel: { ...typography.label, marginBottom: spacing.sm },
  input: {
    ...typography.body,
    borderWidth: 1.5,
    borderRadius: radius.sm,
    paddingHorizontal: spacing.md,
    paddingVertical: 13,
  },
});
