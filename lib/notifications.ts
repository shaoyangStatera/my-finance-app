import * as Notifications from 'expo-notifications';
import { registerPushToken } from './api';

/**
 * Requests notification permission and registers the Expo push token with our server.
 * Native only — web uses notifications.web.ts stub instead.
 */
export async function registerForPushNotifications(): Promise<void> {
  try {
    const { status: existingStatus } = await Notifications.getPermissionsAsync();
    let finalStatus = existingStatus;

    if (existingStatus !== 'granted') {
      const { status } = await Notifications.requestPermissionsAsync();
      finalStatus = status;
    }

    if (finalStatus !== 'granted') return;

    const tokenData = await Notifications.getExpoPushTokenAsync();
    if (tokenData?.data) {
      await registerPushToken(tokenData.data);
    }
  } catch (err) {
    // Non-critical — log but don't crash
    console.warn('Push registration failed:', err);
  }
}

/**
 * Configure how notifications are displayed while the app is in the foreground.
 * Native only — web uses notifications.web.ts stub instead.
 */
export function configureForegroundNotifications(): void {
  Notifications.setNotificationHandler({
    handleNotification: async () => ({
      shouldShowBanner: true,
      shouldShowList: true,
      shouldPlaySound: false,
      shouldSetBadge: true,
    }),
  });
}
