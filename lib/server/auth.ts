import jwt from 'jsonwebtoken';
import bcrypt from 'bcryptjs';
import type { VercelRequest } from '@vercel/node';
import type { OtpPurpose } from './email-config';
import { SESSION } from './rate-limit';

const JWT_SECRET = process.env.JWT_SECRET ?? 'dev-secret-change-in-production';

export interface JwtPayload {
  userId: string;
  email: string;
  displayName: string;
  familyId?: string;
  type?: 'access';
}

export interface PendingOTPPayload {
  userId: string;
  email: string;
  displayName: string;
  type: 'pending_otp';
  purpose: OtpPurpose;
}

type AnyTokenPayload = JwtPayload | PendingOTPPayload | { type: 'pending_2fa' };

function decodeToken(token: string): AnyTokenPayload | null {
  try {
    return jwt.verify(token, JWT_SECRET) as AnyTokenPayload;
  } catch {
    return null;
  }
}

export function signAccessToken(payload: Omit<JwtPayload, 'type'>): string {
  return jwt.sign({ ...payload, type: 'access' }, JWT_SECRET, {
    expiresIn: SESSION.accessTokenExpiry,
  });
}

export function signPendingOTPToken(payload: Omit<PendingOTPPayload, 'type'>): string {
  return jwt.sign({ ...payload, type: 'pending_otp' }, JWT_SECRET, {
    expiresIn: SESSION.pending2faExpiry,
  });
}

export function verifyAccessToken(token: string): JwtPayload | null {
  const payload = decodeToken(token);
  if (!payload || payload.type !== 'access') return null;
  return payload as JwtPayload;
}

export function verifyPendingOTPToken(token: string): PendingOTPPayload | null {
  const payload = decodeToken(token);
  if (!payload || payload.type !== 'pending_otp') return null;
  return payload as PendingOTPPayload;
}

export async function hashPassword(password: string): Promise<string> {
  return bcrypt.hash(password, 10);
}

export async function comparePassword(password: string, hash: string): Promise<boolean> {
  return bcrypt.compare(password, hash);
}

export async function getAuthUser(req: VercelRequest): Promise<JwtPayload | null> {
  const header = req.headers.authorization;
  if (!header?.startsWith('Bearer ')) return null;
  return verifyAccessToken(header.slice(7));
}

export async function requireAuth(req: VercelRequest): Promise<JwtPayload> {
  const user = await getAuthUser(req);
  if (!user) {
    throw new Error('Unauthorized');
  }
  return user;
}

export { JWT_SECRET };
