export const OTP_EXPIRY_MS = 10 * 60 * 1000;
export const PASSWORD_MAX_AGE_DAYS = 90;
export const PASSWORD_MIN_LENGTH = 16;

export type OtpPurpose = 'login' | 'password_reset' | 'email_verify';
