import { AuthProvider } from '@/contexts/AuthContext';
import { CheckinProvider } from '@/contexts/CheckinContext';
import { FamilyProvider } from '@/contexts/FamilyContext';
import { HousingProvider } from '@/contexts/HousingContext';
import { NotificationsProvider } from '@/contexts/NotificationsContext';
import { PreferencesProvider, usePreferences } from '@/contexts/PreferencesContext';
import { ViewModeProvider } from '@/contexts/ViewModeContext';
import { colors } from '@/lib/design-tokens';
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

export { ErrorBoundary } from 'expo-router';

SplashScreen.preventAutoHideAsync();
if (Platform.OS !== 'web') configureForegroundNotifications();

function AppShell() {
  const { prefs } = usePreferences();
  return (
    <View style={{ flex: 1, backgroundColor: prefs.bgColor }}>
      <StatusBar style="dark" />
      <Stack screenOptions={{ headerShown: false, contentStyle: { backgroundColor: prefs.bgColor } }}>
        <Stack.Screen name="index" />
        <Stack.Screen name="welcome" />
        <Stack.Screen name="login" />
        <Stack.Screen name="register" />
        <Stack.Screen name="onboarding" />
        <Stack.Screen name="(tabs)" />
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
      </PreferencesProvider>
    </AuthProvider>
  );
}
