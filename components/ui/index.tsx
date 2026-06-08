import { colors, layout, radius, shadow, spacing, typography } from '@/lib/design-tokens';
import { usePreferences } from '@/contexts/PreferencesContext';
import { ReactNode } from 'react';
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
  const { prefs } = usePreferences();
  const content = scroll ? (
    <ScrollView
      contentContainerStyle={[styles.scrollContent, style]}
      keyboardShouldPersistTaps="handled"
      showsVerticalScrollIndicator={false}>
      {children}
    </ScrollView>
  ) : (
    <View style={[styles.scrollContent, style]}>{children}</View>
  );

  return (
    <KeyboardAvoidingView
      style={[styles.screen, { paddingTop: insets.top, backgroundColor: prefs.bgColor }]}
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
  return (
    <View
      style={[
        styles.card,
        elevated && styles.cardElevated,
        tinted && styles.cardTinted,
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
    <View style={[styles.statContainer, bgColor ? { backgroundColor: bgColor, borderRadius: radius.sm, padding: spacing.md } : undefined]}>
      <Text style={styles.statLabel}>{label}</Text>
      <Text style={[styles.statValue, large && styles.statValueLarge, { color: valueColor }]}>
        {value}
      </Text>
      {hint ? <Text style={styles.statHint}>{hint}</Text> : null}
    </View>
  );
}

interface SectionHeaderProps {
  title: string;
  subtitle?: string;
}

export function SectionHeader({ title, subtitle }: SectionHeaderProps) {
  return (
    <View style={styles.sectionHeader}>
      <Text style={styles.sectionTitle}>{title}</Text>
      {subtitle ? <Text style={styles.sectionSubtitle}>{subtitle}</Text> : null}
    </View>
  );
}

interface BadgeProps {
  label: string;
  tone?: 'accent' | 'positive' | 'negative' | 'warning' | 'neutral';
}

export function Badge({ label, tone = 'neutral' }: BadgeProps) {
  const styles2 = badgeStyles[tone];
  return (
    <View style={[badgeBase.badge, styles2.badge]}>
      <Text style={[badgeBase.text, styles2.text]}>{label}</Text>
    </View>
  );
}

const badgeBase = StyleSheet.create({
  badge: { borderRadius: 99, paddingVertical: 3, paddingHorizontal: 10, alignSelf: 'flex-start' },
  text: { fontSize: 11, fontWeight: '600', fontFamily: 'Inter_600SemiBold', letterSpacing: 0.3 },
});
const badgeStyles = {
  accent:   StyleSheet.create({ badge: { backgroundColor: colors.accentLight }, text: { color: colors.accent } }),
  positive: StyleSheet.create({ badge: { backgroundColor: colors.positiveLight }, text: { color: colors.positive } }),
  negative: StyleSheet.create({ badge: { backgroundColor: colors.negativeLight }, text: { color: colors.negative } }),
  warning:  StyleSheet.create({ badge: { backgroundColor: colors.warningLight }, text: { color: colors.warning } }),
  neutral:  StyleSheet.create({ badge: { backgroundColor: colors.borderLight }, text: { color: colors.textSecondary } }),
};

interface ButtonProps {
  label: string;
  onPress: () => void;
  variant?: 'primary' | 'secondary' | 'ghost' | 'danger';
  disabled?: boolean;
  loading?: boolean;
  icon?: string;
}

export function Button({
  label,
  onPress,
  variant = 'primary',
  disabled = false,
  loading = false,
}: ButtonProps) {
  return (
    <Pressable
      onPress={onPress}
      disabled={disabled || loading}
      style={({ pressed }) => [
        styles.button,
        variant === 'primary' && styles.buttonPrimary,
        variant === 'secondary' && styles.buttonSecondary,
        variant === 'ghost' && styles.buttonGhost,
        variant === 'danger' && styles.buttonDanger,
        (disabled || loading) && styles.buttonDisabled,
        pressed && !disabled && styles.buttonPressed,
      ]}>
      {loading ? (
        <ActivityIndicator color={variant === 'primary' || variant === 'danger' ? '#fff' : colors.accent} />
      ) : (
        <Text
          style={[
            styles.buttonLabel,
            variant === 'primary' && styles.buttonLabelPrimary,
            variant === 'danger' && styles.buttonLabelPrimary,
            (variant === 'secondary' || variant === 'ghost') && styles.buttonLabelSecondary,
          ]}>
          {label}
        </Text>
      )}
    </Pressable>
  );
}

interface InputProps extends TextInputProps {
  label: string;
}

export function Input({ label, style, ...props }: InputProps) {
  return (
    <View style={styles.inputGroup}>
      <Text style={styles.inputLabel}>{label}</Text>
      <TextInput
        placeholderTextColor={colors.textMuted}
        style={[styles.input, style]}
        {...props}
      />
    </View>
  );
}

interface MoneyInputProps extends Omit<InputProps, 'onChangeText' | 'value'> {
  value: number;
  onChangeValue: (value: number) => void;
}

export function MoneyInput({ value, onChangeValue, ...props }: MoneyInputProps) {
  return (
    <Input
      {...props}
      value={value === 0 ? '' : String(value)}
      keyboardType="numeric"
      placeholder="0"
      onChangeText={(text) => {
        const parsed = Number(text.replace(/[^0-9.]/g, ''));
        onChangeValue(Number.isNaN(parsed) ? 0 : parsed);
      }}
    />
  );
}

const styles = StyleSheet.create({
  screen: {
    flex: 1,
    backgroundColor: colors.background,
  },
  scrollContent: {
    paddingHorizontal: spacing.md,
    paddingBottom: spacing.xxl + layout.tabBarHeight,
    maxWidth: layout.maxContentWidth,
    width: '100%',
    alignSelf: 'center',
  },
  card: {
    backgroundColor: colors.surface,
    borderWidth: 1,
    borderColor: colors.border,
    borderRadius: radius.md,
    padding: spacing.lg,
    marginBottom: spacing.md,
    ...shadow.card,
  },
  cardElevated: {
    ...shadow.elevated,
    borderWidth: 0,
  },
  cardTinted: {
    backgroundColor: colors.accentLight,
    borderColor: '#C8DDD4',
  },
  statContainer: {
    marginBottom: spacing.sm,
  },
  statLabel: {
    ...typography.label,
    color: colors.textMuted,
    marginBottom: spacing.xs,
  },
  statValue: {
    ...typography.stat,
    color: colors.text,
  },
  statValueLarge: {
    fontSize: 38,
    letterSpacing: -1,
  },
  statHint: {
    ...typography.caption,
    color: colors.textSecondary,
    marginTop: spacing.xs,
  },
  sectionHeader: {
    marginBottom: spacing.md,
    marginTop: spacing.sm,
  },
  sectionTitle: {
    ...typography.title,
    color: colors.text,
    fontSize: 22,
  },
  sectionSubtitle: {
    ...typography.caption,
    color: colors.textSecondary,
    marginTop: spacing.xs,
  },
  button: {
    borderRadius: radius.sm,
    paddingVertical: spacing.md,
    paddingHorizontal: spacing.lg,
    alignItems: 'center',
    justifyContent: 'center',
    minHeight: 50,
  },
  buttonPrimary: {
    backgroundColor: colors.accent,
    ...shadow.card,
  },
  buttonSecondary: {
    backgroundColor: colors.surface,
    borderWidth: 1.5,
    borderColor: colors.border,
  },
  buttonGhost: {
    backgroundColor: 'transparent',
  },
  buttonDanger: {
    backgroundColor: colors.negative,
  },
  buttonDisabled: {
    opacity: 0.45,
  },
  buttonPressed: {
    opacity: 0.82,
    transform: [{ scale: 0.98 }],
  },
  buttonLabel: {
    ...typography.bodyMedium,
    fontSize: 15,
  },
  buttonLabelPrimary: {
    color: '#FFFFFF',
    fontFamily: 'Inter_600SemiBold',
    fontWeight: '600',
  },
  buttonLabelSecondary: {
    color: colors.text,
  },
  inputGroup: {
    marginBottom: spacing.md,
  },
  inputLabel: {
    ...typography.label,
    color: colors.textMuted,
    marginBottom: spacing.sm,
  },
  input: {
    ...typography.body,
    color: colors.text,
    backgroundColor: colors.surface,
    borderWidth: 1.5,
    borderColor: colors.border,
    borderRadius: radius.sm,
    paddingHorizontal: spacing.md,
    paddingVertical: 13,
  },
});
