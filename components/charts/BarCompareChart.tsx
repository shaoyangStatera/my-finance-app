import { Card } from '@/components/ui';
import { formatCurrency } from '@/lib/format';
import type { BarCompareItem } from '@/lib/chart-data';
import { colors, spacing, typography } from '@/lib/design-tokens';
import { ScrollView, StyleSheet, Text, View } from 'react-native';
import { BarChart } from 'react-native-gifted-charts';

interface BarCompareChartProps {
  title: string;
  subtitle?: string;
  items: BarCompareItem[];
}

export function BarCompareChart({ title, subtitle, items }: BarCompareChartProps) {
  const filtered = items.filter((item) => item.budget > 0 || item.spent > 0);

  if (filtered.length === 0) {
    return (
      <Card>
        <Text style={styles.title}>{title}</Text>
        {subtitle ? <Text style={styles.subtitle}>{subtitle}</Text> : null}
        <Text style={styles.empty}>Add budget or spent amounts to see the chart.</Text>
      </Card>
    );
  }

  const maxValue = Math.max(...filtered.flatMap((item) => [item.budget, item.spent]), 1);
  const chartWidth = Math.max(300, filtered.length * 64);

  const stackData = filtered.map((item) => {
    if (item.spent > item.budget) {
      return {
        label: item.label,
        stacks: [{ value: item.spent, color: colors.negative as string }],
      };
    }
    const stacks: { value: number; color: string }[] = [
      { value: item.spent, color: colors.accent },
    ];
    if (item.budget > item.spent) {
      stacks.push({ value: item.budget - item.spent, color: colors.accentLight });
    }
    return { label: item.label, stacks };
  });

  return (
    <Card>
      <Text style={styles.title}>{title}</Text>
      {subtitle ? <Text style={styles.subtitle}>{subtitle}</Text> : null}
      <View style={styles.legendRow}>
        <View style={styles.legendItem}>
          <View style={[styles.swatch, { backgroundColor: colors.accent }]} />
          <Text style={styles.legendText}>Spent</Text>
        </View>
        <View style={styles.legendItem}>
          <View style={[styles.swatch, { backgroundColor: colors.accentLight }]} />
          <Text style={styles.legendText}>Under budget</Text>
        </View>
        <View style={styles.legendItem}>
          <View style={[styles.swatch, { backgroundColor: colors.negative }]} />
          <Text style={styles.legendText}>Over budget</Text>
        </View>
      </View>
      <ScrollView horizontal showsHorizontalScrollIndicator={false}>
        <BarChart
          width={chartWidth}
          maxValue={maxValue * 1.2}
          noOfSections={4}
          barWidth={28}
          spacing={20}
          initialSpacing={16}
          stackData={stackData}
          yAxisTextStyle={styles.axis}
          xAxisLabelTextStyle={styles.axis}
        />
      </ScrollView>
    </Card>
  );
}

const styles = StyleSheet.create({
  title: {
    ...typography.label,
    color: colors.textMuted,
    marginBottom: spacing.xs,
  },
  subtitle: {
    ...typography.caption,
    color: colors.textSecondary,
    marginBottom: spacing.md,
  },
  empty: {
    ...typography.caption,
    color: colors.textMuted,
    marginTop: spacing.sm,
  },
  legendRow: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: spacing.md,
    marginBottom: spacing.md,
  },
  legendItem: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.sm,
  },
  swatch: {
    width: 10,
    height: 10,
    borderRadius: 2,
  },
  legendText: {
    ...typography.caption,
    color: colors.textSecondary,
  },
  axis: {
    color: colors.textMuted,
    fontSize: 10,
  },
});
