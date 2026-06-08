import { getToken } from './auth-storage';
import type {
  AppNotification,
  AuthResponse,
  Family,
  HousingData,
  LoginStepOneResponse,
  MonthlyCheckin,
  RegisterResponse,
  StockQuote,
  User,
} from './types';

const API_BASE = process.env.EXPO_PUBLIC_API_URL ?? '';

export class ApiError extends Error {
  status: number;
  retryAfterSeconds?: number;

  constructor(message: string, status: number, retryAfterSeconds?: number) {
    super(message);
    this.status = status;
    this.retryAfterSeconds = retryAfterSeconds;
  }
}

async function request<T>(path: string, options: RequestInit = {}): Promise<T> {
  const token = await getToken();
  const headers: Record<string, string> = {
    'Content-Type': 'application/json',
    ...(options.headers as Record<string, string>),
  };
  if (token) headers.Authorization = `Bearer ${token}`;

  const response = await fetch(`${API_BASE}${path}`, { ...options, headers });
  const data = await response.json().catch(() => ({}));

  if (!response.ok) {
    throw new ApiError(data.error ?? 'Something went wrong', response.status, data.retryAfterSeconds);
  }

  return data as T;
}

// ─── Auth ──────────────────────────────────────────────────────────────────────

export async function register(
  email: string,
  password: string,
  displayName: string,
): Promise<RegisterResponse> {
  return request<RegisterResponse>('/api/auth/register', {
    method: 'POST',
    body: JSON.stringify({ email, password, displayName }),
  });
}

export async function verifyEmail(
  pendingToken: string,
  code: string,
): Promise<AuthResponse> {
  return request<AuthResponse>('/api/auth/verify-email', {
    method: 'POST',
    body: JSON.stringify({ pendingToken, code }),
  });
}

export async function login(email: string, password: string): Promise<LoginStepOneResponse> {
  return request<LoginStepOneResponse>('/api/auth/login', {
    method: 'POST',
    body: JSON.stringify({ email, password }),
  });
}

export async function verifyOtp(pendingToken: string, code: string): Promise<AuthResponse> {
  return request<AuthResponse>('/api/auth/verify-otp', {
    method: 'POST',
    body: JSON.stringify({ pendingToken, code }),
  });
}

export async function resetPassword(
  pendingToken: string,
  code: string,
  newPassword: string,
): Promise<AuthResponse & { message: string }> {
  return request('/api/auth/reset-password', {
    method: 'POST',
    body: JSON.stringify({ pendingToken, code, newPassword }),
  });
}

// ─── Family ────────────────────────────────────────────────────────────────────

export async function getFamily(): Promise<Family> {
  return request<Family>('/api/family');
}

export async function createFamily(name: string): Promise<{ token: string; family: Family; user: User }> {
  return request('/api/family/create', { method: 'POST', body: JSON.stringify({ name }) });
}

export async function joinFamily(inviteCode: string): Promise<{ message: string; familyName: string }> {
  return request('/api/family/join', { method: 'POST', body: JSON.stringify({ inviteCode }) });
}

export async function approveFamilyRequest(
  userId: string,
  action: 'approve' | 'reject',
): Promise<{ message: string }> {
  return request('/api/family/approve', { method: 'POST', body: JSON.stringify({ userId, action }) });
}

export async function transferAdmin(newAdminUserId: string): Promise<{ token: string; message: string; user: User }> {
  return request('/api/family/transfer-admin', { method: 'POST', body: JSON.stringify({ newAdminUserId }) });
}

export async function setMemberLabel(targetUserId: string, label: string): Promise<{ message: string }> {
  return request('/api/family/set-label', { method: 'POST', body: JSON.stringify({ targetUserId, label }) });
}

export async function inviteByEmail(email: string): Promise<{ message: string }> {
  return request('/api/family/invite-email', { method: 'POST', body: JSON.stringify({ email }) });
}

export async function getNotifications(limit = 50): Promise<AppNotification[]> {
  return request<AppNotification[]>(`/api/notifications?limit=${limit}`);
}

export async function markNotificationsRead(ids?: string[]): Promise<{ message: string }> {
  return request('/api/notifications', { method: 'POST', body: JSON.stringify({ ids: ids ?? [] }) });
}

export async function registerPushToken(token: string): Promise<{ message: string }> {
  return request('/api/push-token', { method: 'POST', body: JSON.stringify({ token }) });
}

export async function updateNotificationPrefs(
  prefs: { cpf: boolean; investment: boolean; expense: boolean },
): Promise<{ message: string }> {
  return request('/api/auth/notification-prefs', { method: 'POST', body: JSON.stringify(prefs) });
}

export async function requestEmailChange(newEmail: string): Promise<{ message: string }> {
  return request('/api/auth/request-email-change', { method: 'POST', body: JSON.stringify({ newEmail }) });
}

export async function confirmEmailChange(
  code: string,
): Promise<{ token: string; user: import('./types').User; message: string }> {
  return request('/api/auth/confirm-email-change', { method: 'POST', body: JSON.stringify({ code }) });
}

// ─── Check-ins ─────────────────────────────────────────────────────────────────

export async function fetchCheckins(): Promise<MonthlyCheckin[]> {
  return request<MonthlyCheckin[]>('/api/checkins');
}

export async function fetchCheckin(monthYear: string): Promise<MonthlyCheckin> {
  return request<MonthlyCheckin>(`/api/checkins/${monthYear}`);
}

export async function saveCheckin(checkin: MonthlyCheckin): Promise<MonthlyCheckin> {
  return request<MonthlyCheckin>(`/api/checkins/${checkin.monthYear}`, {
    method: 'PUT',
    body: JSON.stringify(checkin),
  });
}

// ─── Stock quotes ──────────────────────────────────────────────────────────────

export async function fetchStockQuote(ticker: string): Promise<StockQuote> {
  return request<StockQuote>(`/api/stock-quote?ticker=${encodeURIComponent(ticker)}`);
}

// ─── Housing ───────────────────────────────────────────────────────────────────

export async function fetchHousing(): Promise<HousingData> {
  return request<HousingData>('/api/housing');
}

export async function saveHousing(data: HousingData): Promise<HousingData> {
  return request<HousingData>('/api/housing', { method: 'PUT', body: JSON.stringify(data) });
}
