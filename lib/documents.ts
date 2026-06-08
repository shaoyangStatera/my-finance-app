import { Platform } from 'react-native';
import * as Linking from 'expo-linking';

const BROCHURE_FILENAME = 'alexandra-vista-brochure.pdf';

export function getBrochureUrl(): string {
  if (Platform.OS === 'web' && typeof window !== 'undefined') {
    return `${window.location.origin}/documents/${BROCHURE_FILENAME}`;
  }
  // Mobile loads from the same Vercel-hosted public folder in production
  const apiBase = process.env.EXPO_PUBLIC_API_URL?.replace(/\/$/, '');
  if (apiBase) {
    return `${apiBase}/documents/${BROCHURE_FILENAME}`;
  }
  return `/documents/${BROCHURE_FILENAME}`;
}

export async function openBrochure(): Promise<void> {
  const url = getBrochureUrl();
  await Linking.openURL(url);
}
