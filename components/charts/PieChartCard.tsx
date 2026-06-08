import { Card } from '@/components/ui';
import { useColors } from '@/contexts/ThemeContext';
import { usePreferences } from '@/contexts/PreferencesContext';
import { formatCurrency } from '@/lib/format';
import { CHART_PALETTE_DARK, CHART_PALETTE_LIGHT, sumSlices, type ChartSlice } from '@/lib/chart-colors';
import { radius, spacing, typography } from '@/lib/design-tokens';
import { useMemo } from 'react';
import { StyleSheet, Text, View } from 'react-native';
import { PieChart } from 'react-native-gifted-charts';

interface PieChartCardProps {
  title: string;
  subtitle?: string;
  data: ChartSlice[];
  centerLabel?: string;
  compact?: boolean;
}

function PieChartInner({ title, subtitle, data, centerLabel, compact }: PieChartCardProps) {
  const colors = useColors();
  const styles = useMemo(() => makeStyles(colors), [colors]);
  const { prefs } = usePreferences();
  // Remap slice colors to the correct palette for the current theme
  const palette = prefs.darkMode ? CHART_PALETTE_DARK : CHART_PALETTE_LIGHT;
  const themedData = useMemo(
    () => data.map((s, i) => ({ ...s, color: palette[i % palette.length] })),
    [data, palette],
  );
  const total = sumSlices(themedData);
  const radius_size = compact ? 72 : 80;
  const inner_size = compact ? 44 : 50;

  if (themedData.length === 0 || total <= 0) {
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

  const pieData = themedData.map((slice) => ({ value: slice.value, color: slice.color }));

  return (
    <View>
      <Text style={styles.title}>{title}</Text>
      {subtitle ? <Text style={styles.subtitle}>{subtitle}</Text> : null}
      <View style={[staticStyles.chartRow, compact && staticStyles.chartRowCompact]}>
        <View style={staticStyles.chartWrap}>
          <PieChart
            data={pieData}
            donut
            radius={radius_size}
            innerRadius={inner_size}
            innerCircleColor={colors.surface}
            strokeColor={colors.surface}
            strokeWidth={2}
            centerLabelComponent={() => (
              <View style={staticStyles.center}>
                <Text style={styles.centerLabel}>{centerLabel ?? 'Total'}</Text>
                <Text style={[styles.centerValue, compact && staticStyles.centerValueCompact]}>
                  {formatCurrency(total)}
                </Text>
              </View>
            )}
          />
        </View>
        <View style={[staticStyles.legend, compact && staticStyles.legendCompact]}>
          {themedData.map((slice) => {
            const pct = ((slice.value / total) * 100).toFixed(0);
            return (
              <View key={slice.label} style={staticStyles.legendRow}>
                <View style={[staticStyles.swatch, { backgroundColor: slice.color }]} />
                <View style={staticStyles.legendText}>
                  <Text style={styles.legendLabel} numberOfLines={2}>{slice.label}</Text>
                  <Text style={[styles.legendValue, compact && staticStyles.legendValueCompact]}>
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
  if (props.compact) return <PieChartInner {...props} />;
  return <Card><PieChartInner {...props} /></Card>;
}

function makeStyles(c: ReturnType<typeof useColors>) {
  return StyleSheet.create({
    title:        { ...typography.label, color: c.textMuted, marginBottom: spacing.md },
    subtitle:     { ...typography.caption, color: c.textSecondary, marginBottom: spacing.md },
    emptyContainer: { alignItems: 'center', paddingVertical: spacing.xl, backgroundColor: c.borderLight, borderRadius: radius.sm, marginTop: spacing.sm },
    compactEmpty: { flex: 1 },
    empty:        { ...typography.caption, color: c.textMuted },
    centerLabel:  { fontSize: 9, fontFamily: 'Inter_600SemiBold', fontWeight: '600', color: c.textMuted, letterSpacing: 0.8, textTransform: 'uppercase', marginBottom: 2 },
    centerValue:  { fontSize: 12, fontFamily: 'Inter_600SemiBold', fontWeight: '600', color: c.text, textAlign: 'center' },
    legendLabel:  { ...typography.caption, color: c.text, lineHeight: 17 },
    legendValue:  { fontSize: 12, fontFamily: 'Inter_500Medium', fontWeight: '500', color: c.textSecondary, marginTop: 1 },
    legendPct:    { color: c.textMuted, fontSize: 11 },
  });
}

const staticStyles = StyleSheet.create({
  chartRow:         { flexDirection: 'row', alignItems: 'center', gap: spacing.md, flexWrap: 'wrap' },
  chartRowCompact:  { flexWrap: 'nowrap' },
  chartWrap:        { alignItems: 'center', justifyContent: 'center' },
  center:           { alignItems: 'center', justifyContent: 'center', paddingHorizontal: 4 },
  centerValueCompact: { fontSize: 11 },
  legend:           { flex: 1, minWidth: 130, gap: spacing.sm + 2 },
  legendCompact:    { minWidth: 0, gap: spacing.xs },
  legendRow:        { flexDirection: 'row', alignItems: 'flex-start', gap: spacing.sm },
  swatch:           { width: 8, height: 8, borderRadius: 2, marginTop: 5, flexShrink: 0 },
  legendText:       { flex: 1 },
  legendValueCompact: { fontSize: 11 },
});
