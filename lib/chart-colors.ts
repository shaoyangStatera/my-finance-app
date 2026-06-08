import { lightColors, darkColors } from './design-tokens';

export const CHART_PALETTE_LIGHT = [
  lightColors.chart1,
  '#8B9E94',
  '#A68B7B',
  '#7A8FA3',
  '#C4A574',
  '#6B8E7B',
  '#9C8FA8',
  '#B8A99A',
] as const;

export const CHART_PALETTE_DARK = [
  darkColors.chart1,
  darkColors.chart2,
  darkColors.chart3,
  darkColors.chart4,
  darkColors.chart5,
  darkColors.chart6,
  darkColors.chart7,
  darkColors.chart8,
] as const;

// Backward compat
export const CHART_PALETTE = CHART_PALETTE_LIGHT;

export interface ChartSlice {
  label: string;
  value: number;
  color: string;
}

export function assignColors(
  items: { label: string; value: number }[],
  palette: readonly string[] = CHART_PALETTE_LIGHT,
): ChartSlice[] {
  return items
    .filter((item) => item.value > 0)
    .map((item, index) => ({
      ...item,
      color: palette[index % palette.length],
    }));
}

export function sumSlices(slices: ChartSlice[]): number {
  return slices.reduce((sum, slice) => sum + slice.value, 0);
}
