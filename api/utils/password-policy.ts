import { PASSWORD_MAX_AGE_DAYS } from './email-config';

export const PASSWORD_MAX_AGE_MS = PASSWORD_MAX_AGE_DAYS * 24 * 60 * 60 * 1000;

export function isPasswordExpired(passwordChangedAt?: string | Date | null): boolean {
  if (!passwordChangedAt) return true;
  const changed = new Date(passwordChangedAt).getTime();
  if (Number.isNaN(changed)) return true;
  return Date.now() - changed > PASSWORD_MAX_AGE_MS;
}

export function validateNewPassword(password: string): string | null {
  if (password.length < 12) {
    return 'Password must be at least 12 characters.';
  }
  if (!/[a-zA-Z]/.test(password)) {
    return 'Password must contain at least one letter.';
  }
  if (!/[0-9]/.test(password)) {
    return 'Password must contain at least one number.';
  }
  if (!/[^a-zA-Z0-9]/.test(password)) {
    return 'Password must contain at least one special character (e.g. !@#$%).';
  }
  return null;
}
