import type { VercelRequest } from '@vercel/node';
import { connectToDatabase } from './db';

export const RATE_LIMITS = {
  login: { maxAttempts: 5, windowMs: 15 * 60 * 1000, lockoutMs: 15 * 60 * 1000 },
  verify2fa: { maxAttempts: 5, windowMs: 15 * 60 * 1000, lockoutMs: 15 * 60 * 1000 },
} as const;

export const SESSION = {
  accessTokenExpiry: '8h' as const,
  pending2faExpiry: '5m' as const,
  inactivityTimeoutMs: 30 * 60 * 1000,
} as const;

interface RateLimitDoc {
  key: string;
  attempts: number;
  windowStart: Date;
  lockedUntil: Date | null;
}

export interface RateLimitResult {
  allowed: boolean;
  retryAfterSeconds?: number;
}

export function getClientIp(req: VercelRequest): string {
  const forwarded = req.headers['x-forwarded-for'];
  if (typeof forwarded === 'string' && forwarded.length > 0) {
    return forwarded.split(',')[0].trim();
  }
  if (Array.isArray(forwarded) && forwarded[0]) {
    return forwarded[0].split(',')[0].trim();
  }
  return req.socket?.remoteAddress ?? 'unknown';
}

export async function checkRateLimit(
  key: string,
  config: { maxAttempts: number; windowMs: number; lockoutMs: number },
): Promise<RateLimitResult> {
  const { db } = await connectToDatabase();
  const collection = db.collection<RateLimitDoc>('rate_limits');
  const now = new Date();
  const doc = await collection.findOne({ key });

  if (doc?.lockedUntil && doc.lockedUntil > now) {
    return {
      allowed: false,
      retryAfterSeconds: Math.ceil((doc.lockedUntil.getTime() - now.getTime()) / 1000),
    };
  }

  if (!doc || now.getTime() - doc.windowStart.getTime() > config.windowMs) {
    return { allowed: true };
  }

  if (doc.attempts >= config.maxAttempts) {
    const lockedUntil = new Date(now.getTime() + config.lockoutMs);
    await collection.updateOne({ key }, { $set: { lockedUntil, attempts: doc.attempts } });
    return {
      allowed: false,
      retryAfterSeconds: Math.ceil(config.lockoutMs / 1000),
    };
  }

  return { allowed: true };
}

export async function recordRateLimitFailure(
  key: string,
  config: { maxAttempts: number; windowMs: number; lockoutMs: number },
): Promise<RateLimitResult> {
  const { db } = await connectToDatabase();
  const collection = db.collection<RateLimitDoc>('rate_limits');
  const now = new Date();
  const doc = await collection.findOne({ key });

  if (!doc || now.getTime() - doc.windowStart.getTime() > config.windowMs) {
    await collection.updateOne(
      { key },
      { $set: { key, attempts: 1, windowStart: now, lockedUntil: null } },
      { upsert: true },
    );
    return { allowed: true };
  }

  const attempts = doc.attempts + 1;
  const lockedUntil =
    attempts >= config.maxAttempts ? new Date(now.getTime() + config.lockoutMs) : null;

  await collection.updateOne(
    { key },
    { $set: { attempts, lockedUntil, windowStart: doc.windowStart } },
  );

  if (lockedUntil) {
    return {
      allowed: false,
      retryAfterSeconds: Math.ceil(config.lockoutMs / 1000),
    };
  }

  return { allowed: true };
}

export async function clearRateLimit(key: string): Promise<void> {
  const { db } = await connectToDatabase();
  await db.collection('rate_limits').deleteOne({ key });
}

export function rateLimitErrorMessage(retryAfterSeconds?: number): string {
  if (!retryAfterSeconds) return 'Too many attempts. Please try again later.';
  const minutes = Math.ceil(retryAfterSeconds / 60);
  return `Too many attempts. Try again in ${minutes} minute${minutes === 1 ? '' : 's'}.`;
}
