import { AuthProvider } from '@/contexts/AuthContext';
import { CheckinProvider } from '@/contexts/CheckinContext';
import { FamilyProvider } from '@/contexts/FamilyContext';
import { HousingProvider } from '@/contexts/HousingContext';
import { NotificationsProvider } from '@/contexts/NotificationsContext';
import { PreferencesProvider } from '@/contexts/PreferencesContext';
import { ThemeProvider, useColors } from '@/contexts/ThemeContext';
import { ViewModeProvider } from '@/contexts/ViewModeContext';
import { configureForegroundNotifications, registerForPushNotifications } from '@/lib/notifications';
import {
  Inter_400Regular,
  Inter_500Medium,
  Inter_600SemiBold,
  useFonts,
} from '@expo-google-fonts/inter';
import { Stack } from 'expo-router';
import * as SplashScreen from 'expo-splash-screen';
import { useEffect } from 'react';
import { StatusBar } from 'expo-status-bar';
import { Platform, View } from 'react-native';
import { usePreferences } from '@/contexts/PreferencesContext';

export { ErrorBoundary } from 'expo-router';

SplashScreen.preventAutoHideAsync();
if (Platform.OS !== 'web') configureForegroundNotifications();

function AppShell() {
  const colors = useColors();
  const { prefs } = usePreferences();
  return (
    <View style={{ flex: 1, backgroundColor: colors.background }}>
      <StatusBar style={prefs.darkMode ? 'light' : 'dark'} />
      <Stack screenOptions={{ headerShown: false, contentStyle: { backgroundColor: colors.background } }}>
        <Stack.Screen name="index" />
        <Stack.Screen name="welcome" />
        <Stack.Screen name="login" />
        <Stack.Screen name="register" />
        <Stack.Screen name="onboarding" />
        <Stack.Screen name="(tabs)" />
        <Stack.Screen name="settings/account" />
        <Stack.Screen name="settings/notifications" />
        <Stack.Screen name="settings/family" />
      </Stack>
    </View>
  );
}

export default function RootLayout() {
  const [loaded, error] = useFonts({
    Inter_400Regular,
    Inter_500Medium,
    Inter_600SemiBold,
  });

  useEffect(() => { if (error) throw error; }, [error]);
  useEffect(() => { if (loaded) SplashScreen.hideAsync(); }, [loaded]);

  useEffect(() => {
    if (loaded && Platform.OS !== 'web') {
      registerForPushNotifications();
    }
  }, [loaded]);

  if (!loaded) return null;

  return (
    <AuthProvider>
      <PreferencesProvider>
        <ThemeProvider>
          <FamilyProvider>
            <CheckinProvider>
              <HousingProvider>
                <NotificationsProvider>
                  <ViewModeProvider>
                    <AppShell />
                  </ViewModeProvider>
                </NotificationsProvider>
              </HousingProvider>
            </CheckinProvider>
          </FamilyProvider>
        </ThemeProvider>
      </PreferencesProvider>
    </AuthProvider>
  );
}
