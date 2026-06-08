export const lightColors = {
  // Surfaces
  background:       '#F5F4F0',
  surface:          '#FFFFFF',
  surfaceElevated:  '#FDFCFB',
  // Borders
  border:           '#E4E1DA',
  borderLight:      '#EDEAE4',
  // Text
  text:             '#18181A',
  textSecondary:    '#5C5C61',
  textMuted:        '#9898A0',
  // Brand — deep sage green
  accent:           '#3D6B57',
  accentMid:        '#527A67',
  accentLight:      '#E8F0EC',
  accentText:       '#FFFFFF',
  // Semantic
  positive:         '#2E7D52',
  positiveLight:    '#E6F4EC',
  negative:         '#C0392B',
  negativeLight:    '#FBEAE8',
  warning:          '#8A6D2F',
  warningLight:     '#FDF5E6',
  // Hero gradient
  heroFrom:         '#3D6B57',
  heroTo:           '#2A4D3E',
  // Charts
  chart1: '#3D6B57',
  chart2: '#7A9E8F',
  chart3: '#C4A876',
  chart4: '#6B7FA3',
  chart5: '#A87C6B',
  chart6: '#9E8AB4',
  chart7: '#6BAD8A',
  chart8: '#B48A6B',
} as const;

export const darkColors = {
  // Surfaces
  background:       '#111113',
  surface:          '#1C1C22',
  surfaceElevated:  '#242430',
  // Borders
  border:           '#2E2E3A',
  borderLight:      '#252530',
  // Text
  text:             '#F0F0F5',
  textSecondary:    '#9898A8',
  textMuted:        '#5C5C70',
  // Brand — lighter sage for dark bg
  accent:           '#5FAA85',
  accentMid:        '#4D8E6E',
  accentLight:      '#1A2E26',
  accentText:       '#FFFFFF',
  // Semantic
  positive:         '#4DBF7A',
  positiveLight:    '#162B20',
  negative:         '#E05C50',
  negativeLight:    '#2D1613',
  warning:          '#C4963D',
  warningLight:     '#2B2010',
  // Hero gradient
  heroFrom:         '#2A4D3E',
  heroTo:           '#162E22',
  // Charts — more vivid/saturated for dark bg
  chart1: '#5FAA85',
  chart2: '#8FBFA8',
  chart3: '#D4B87A',
  chart4: '#8096BE',
  chart5: '#C49482',
  chart6: '#B095C8',
  chart7: '#7EC89A',
  chart8: '#C89E7A',
} as const;

// Backward compat alias (static — used by non-React code and as the base type)
export const colors = lightColors;

export type Colors = typeof lightColors;

export const spacing = {
  xs: 4,
  sm: 8,
  md: 16,
  lg: 24,
  xl: 32,
  xxl: 48,
} as const;

export const radius = {
  sm: 10,
  md: 16,
  lg: 20,
  xl: 24,
} as const;

export const shadow = {
  card: {
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 1 },
    shadowOpacity: 0.06,
    shadowRadius: 4,
    elevation: 2,
  },
  elevated: {
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.10,
    shadowRadius: 12,
    elevation: 6,
  },
} as const;

export const typography = {
  label: {
    fontSize: 11,
    fontWeight: '600' as const,
    letterSpacing: 1.1,
    textTransform: 'uppercase' as const,
    fontFamily: 'Inter_600SemiBold',
  },
  body: {
    fontSize: 15,
    fontWeight: '400' as const,
    lineHeight: 22,
    fontFamily: 'Inter_400Regular',
  },
  bodyMedium: {
    fontSize: 15,
    fontWeight: '500' as const,
    lineHeight: 22,
    fontFamily: 'Inter_500Medium',
  },
  title: {
    fontSize: 28,
    fontWeight: '300' as const,
    letterSpacing: -0.5,
    fontFamily: 'Inter_400Regular',
  },
  stat: {
    fontSize: 30,
    fontWeight: '600' as const,
    letterSpacing: -0.5,
    fontFamily: 'Inter_600SemiBold',
  },
  caption: {
    fontSize: 13,
    fontWeight: '400' as const,
    lineHeight: 18,
    fontFamily: 'Inter_400Regular',
  },
} as const;

export const layout = {
  maxContentWidth: 720,
  tabBarHeight: 64,
} as const;
