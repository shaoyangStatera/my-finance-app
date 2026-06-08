import { colors } from './design-tokens';

export const CHART_PALETTE = [
  colors.accent,
  '#8B9E94',
  '#A68B7B',
  '#7A8FA3',
  '#C4A574',
  '#6B8E7B',
  '#9C8FA8',
  '#B8A99A',
] as const;

export interface ChartSlice {
  label: string;
  value: number;
  color: string;
}

export function assignColors(
  items: { label: string; value: number }[],
  palette: readonly string[] = CHART_PALETTE,
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
