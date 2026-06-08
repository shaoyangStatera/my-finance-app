import { useColors } from '@/contexts/ThemeContext';
import { shiftMonthYear } from '@/lib/format';
import { type Colors, radius, shadow, spacing, typography } from '@/lib/design-tokens';
import { useMemo } from 'react';
import { Pressable, StyleSheet, Text, View } from 'react-native';

interface MonthPickerProps {
  monthYear: string;
  onChange: (monthYear: string) => void;
  /** compact inline variant — sits beside the page title */
  inline?: boolean;
}

export function MonthPicker({ monthYear, onChange, inline }: MonthPickerProps) {
  const colors = useColors();
  const inlineS = useMemo(() => makeInlineStyles(colors), [colors]);
  const mainS   = useMemo(() => makeMainStyles(colors), [colors]);

  if (inline) {
    return (
      <View style={inlineS.container}>
        <Pressable
          onPress={() => onChange(shiftMonthYear(monthYear, -1))}
          style={({ pressed }) => [inlineS.arrow, pressed && inlineS.pressed]}>
          <Text style={inlineS.arrowText}>‹</Text>
        </Pressable>
        <Text style={inlineS.label}>{formatMonthLabel(monthYear, true)}</Text>
        <Pressable
          onPress={() => onChange(shiftMonthYear(monthYear, 1))}
          style={({ pressed }) => [inlineS.arrow, pressed && inlineS.pressed]}>
          <Text style={inlineS.arrowText}>›</Text>
        </Pressable>
      </View>
    );
  }

  return (
    <View style={mainS.container}>
      <Pressable
        onPress={() => onChange(shiftMonthYear(monthYear, -1))}
        style={({ pressed }) => [mainS.arrow, pressed && mainS.pressed]}>
        <Text style={mainS.arrowText}>‹</Text>
      </Pressable>
      <Text style={mainS.label}>{formatMonthLabel(monthYear, false)}</Text>
      <Pressable
        onPress={() => onChange(shiftMonthYear(monthYear, 1))}
        style={({ pressed }) => [mainS.arrow, pressed && mainS.pressed]}>
        <Text style={mainS.arrowText}>›</Text>
      </Pressable>
    </View>
  );
}

function formatMonthLabel(monthYear: string, short: boolean): string {
  const [year, month] = monthYear.split('-');
  const date = new Date(Number(year), Number(month) - 1, 1);
  return date.toLocaleDateString('en-SG', {
    month: short ? 'short' : 'long',
    year: 'numeric',
  });
}

function makeInlineStyles(colors: Colors) {
  return StyleSheet.create({
    container: { flexDirection: 'row', alignItems: 'center', gap: 4 },
    arrow: {
      width: 28, height: 28, borderRadius: radius.sm,
      borderWidth: 1, borderColor: colors.border,
      alignItems: 'center', justifyContent: 'center',
      backgroundColor: colors.surface, ...shadow.card,
    },
    arrowText: { fontSize: 18, color: colors.textSecondary, lineHeight: 20 },
    label: {
      fontSize: 13, fontFamily: 'Inter_600SemiBold', fontWeight: '600',
      color: colors.text, minWidth: 72, textAlign: 'center', letterSpacing: -0.1,
    },
    pressed: { opacity: 0.6 },
  });
}

function makeMainStyles(colors: Colors) {
  return StyleSheet.create({
    container: {
      flexDirection: 'row', alignItems: 'center', justifyContent: 'center',
      gap: spacing.md, paddingVertical: spacing.md, marginBottom: spacing.sm,
    },
    arrow: {
      width: 36, height: 36, borderRadius: radius.sm,
      borderWidth: 1, borderColor: colors.border,
      alignItems: 'center', justifyContent: 'center',
      backgroundColor: colors.surface, ...shadow.card,
    },
    arrowText: { fontSize: 22, color: colors.textSecondary, lineHeight: 24 },
    label: {
      ...typography.bodyMedium, color: colors.text,
      minWidth: 130, textAlign: 'center', fontSize: 15, letterSpacing: -0.2,
    },
    pressed: { opacity: 0.6 },
  });
}
