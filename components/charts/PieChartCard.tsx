import { Card } from '@/components/ui';
import { formatCurrency } from '@/lib/format';
import { sumSlices, type ChartSlice } from '@/lib/chart-colors';
import { colors, radius, spacing, typography } from '@/lib/design-tokens';
import { StyleSheet, Text, View } from 'react-native';
import { PieChart } from 'react-native-gifted-charts';

interface PieChartCardProps {
  title: string;
  subtitle?: string;
  data: ChartSlice[];
  centerLabel?: string;
  /** Renders without the outer Card — used when placed inside another container */
  compact?: boolean;
}

function PieChartInner({
  title,
  subtitle,
  data,
  centerLabel,
  compact,
}: PieChartCardProps) {
  const total = sumSlices(data);
  const radius_size = compact ? 72 : 80;
  const inner_size = compact ? 44 : 50;

  if (data.length === 0 || total <= 0) {
    return (
      <View style={compact ? styles.compactEmpty : undefined}>
        <Text style={styles.title}>{title}</Text>
        {subtitle ? <Text style={styles.subtitle}>{subtitle}</Text> : null}
        <View style={styles.emptyContainer}>
          <Text style={styles.empty}>Add amounts to see this chart</Text>
        </View>
      </View>
    );
  }

  const pieData = data.map((slice) => ({
    value: slice.value,
    color: slice.color,
  }));

  return (
    <View>
      <Text style={styles.title}>{title}</Text>
      {subtitle ? <Text style={styles.subtitle}>{subtitle}</Text> : null}
      <View style={[styles.chartRow, compact && styles.chartRowCompact]}>
        <View style={styles.chartWrap}>
          <PieChart
            data={pieData}
            donut
            radius={radius_size}
            innerRadius={inner_size}
            innerCircleColor={colors.surface}
            strokeColor={colors.surface}
            strokeWidth={2}
            centerLabelComponent={() => (
              <View style={styles.center}>
                <Text style={styles.centerLabel}>{centerLabel ?? 'Total'}</Text>
                <Text style={[styles.centerValue, compact && styles.centerValueCompact]}>
                  {formatCurrency(total)}
                </Text>
              </View>
            )}
          />
        </View>
        <View style={[styles.legend, compact && styles.legendCompact]}>
          {data.map((slice) => {
            const pct = ((slice.value / total) * 100).toFixed(0);
            return (
              <View key={slice.label} style={styles.legendRow}>
                <View style={[styles.swatch, { backgroundColor: slice.color }]} />
                <View style={styles.legendText}>
                  <Text style={styles.legendLabel} numberOfLines={2}>
                    {slice.label}
                  </Text>
                  <Text style={[styles.legendValue, compact && styles.legendValueCompact]}>
                    {formatCurrency(slice.value)}
                    <Text style={styles.legendPct}>  ({pct}%)</Text>
                  </Text>
                </View>
              </View>
            );
          })}
        </View>
      </View>
    </View>
  );
}

export function PieChartCard(props: PieChartCardProps) {
  if (props.compact) {
    return <PieChartInner {...props} />;
  }
  return (
    <Card>
      <PieChartInner {...props} />
    </Card>
  );
}

const styles = StyleSheet.create({
  title: {
    ...typography.label,
    color: colors.textMuted,
    marginBottom: spacing.md,
  },
  subtitle: {
    ...typography.caption,
    color: colors.textSecondary,
    marginBottom: spacing.md,
  },
  emptyContainer: {
    alignItems: 'center',
    paddingVertical: spacing.xl,
    backgroundColor: colors.borderLight,
    borderRadius: radius.sm,
    marginTop: spacing.sm,
  },
  compactEmpty: {
    flex: 1,
  },
  empty: {
    ...typography.caption,
    color: colors.textMuted,
  },
  chartRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.md,
    flexWrap: 'wrap',
  },
  chartRowCompact: {
    flexWrap: 'nowrap',
  },
  chartWrap: {
    alignItems: 'center',
    justifyContent: 'center',
  },
  center: {
    alignItems: 'center',
    justifyContent: 'center',
    paddingHorizontal: 4,
  },
  centerLabel: {
    fontSize: 9,
    fontFamily: 'Inter_600SemiBold',
    fontWeight: '600',
    color: colors.textMuted,
    letterSpacing: 0.8,
    textTransform: 'uppercase',
    marginBottom: 2,
  },
  centerValue: {
    fontSize: 12,
    fontFamily: 'Inter_600SemiBold',
    fontWeight: '600',
    color: colors.text,
    textAlign: 'center',
  },
  centerValueCompact: {
    fontSize: 11,
  },
  legend: {
    flex: 1,
    minWidth: 130,
    gap: spacing.sm + 2,
  },
  legendCompact: {
    minWidth: 0,
    gap: spacing.xs,
  },
  legendRow: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    gap: spacing.sm,
  },
  swatch: {
    width: 8,
    height: 8,
    borderRadius: 2,
    marginTop: 5,
    flexShrink: 0,
  },
  legendText: {
    flex: 1,
  },
  legendLabel: {
    ...typography.caption,
    color: colors.text,
    lineHeight: 17,
  },
  legendValue: {
    fontSize: 12,
    fontFamily: 'Inter_500Medium',
    fontWeight: '500',
    color: colors.textSecondary,
    marginTop: 1,
  },
  legendValueCompact: {
    fontSize: 11,
  },
  legendPct: {
    color: colors.textMuted,
    fontSize: 11,
  },
});
