import { createContext, ReactNode, useContext, useMemo } from 'react';
import { darkColors, lightColors, type Colors } from '@/lib/design-tokens';
import { usePreferences } from './PreferencesContext';

const ThemeContext = createContext<Colors>(lightColors);

export function ThemeProvider({ children }: { children: ReactNode }) {
  const { prefs } = usePreferences();
  const colors = useMemo(() => (prefs.darkMode ? darkColors : lightColors), [prefs.darkMode]);
  return <ThemeContext.Provider value={colors}>{children}</ThemeContext.Provider>;
}

export function useColors(): Colors {
  return useContext(ThemeContext);
}
