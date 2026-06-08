import type { VercelRequest, VercelResponse } from '@vercel/node';
import { connectToDatabase, handleOptions, setCorsHeaders } from '../utils/db';
import { hashPassword, signPendingOTPToken } from '../utils/auth';
import { createAndSendOtp } from '../utils/email-otp';
import { PASSWORD_MIN_LENGTH } from '../utils/email-config';
import {
  RATE_LIMITS,
  checkRateLimit,
  getClientIp,
  rateLimitErrorMessage,
  recordRateLimitFailure,
} from '../utils/rate-limit';

const EMAIL_RE = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;

export default async function handler(req: VercelRequest, res: VercelResponse) {
  setCorsHeaders(res);
  if (handleOptions(req, res)) return;

  if (req.method !== 'POST') {
    return res.status(405).json({ error: 'Method not allowed' });
  }

  const ip = getClientIp(req);
  const rateKey = `register:${ip}`;

  try {
    const limit = await checkRateLimit(rateKey, RATE_LIMITS.login);
    if (!limit.allowed) {
      return res.status(429).json({
        error: rateLimitErrorMessage(limit.retryAfterSeconds),
        retryAfterSeconds: limit.retryAfterSeconds,
      });
    }

    const { email, password, displayName } = req.body ?? {};

    if (!email || !password || !displayName) {
      return res.status(400).json({ error: 'Email, password, and display name are required' });
    }

    const emailNorm = String(email).toLowerCase().trim();
    if (!EMAIL_RE.test(emailNorm)) {
      return res.status(400).json({ error: 'Invalid email address' });
    }
    if (String(displayName).trim().length < 2) {
      return res.status(400).json({ error: 'Display name must be at least 2 characters' });
    }
    if (String(password).length < PASSWORD_MIN_LENGTH) {
      return res.status(400).json({
        error: `Password must be at least ${PASSWORD_MIN_LENGTH} characters`,
      });
    }

    const { db } = await connectToDatabase();
    const existing = await db.collection('users').findOne({ email: emailNorm });
    if (existing) {
      await recordRateLimitFailure(rateKey, RATE_LIMITS.login);
      // Return same message to avoid email enumeration
      return res.status(400).json({ error: 'An account with this email already exists' });
    }

    const passwordHash = await hashPassword(String(password));
    const now = new Date().toISOString();

    const result = await db.collection('users').insertOne({
      email: emailNorm,
      displayName: String(displayName).trim(),
      passwordHash,
      passwordChangedAt: now,
      emailVerified: false,
      familyId: null,
      familyRole: null,
      onboardingComplete: false,
      createdAt: now,
    });

    const userId = result.insertedId.toString();

    await createAndSendOtp(userId, 'email_verify', emailNorm);

    const pendingToken = signPendingOTPToken({
      userId,
      email: emailNorm,
      displayName: String(displayName).trim(),
      purpose: 'email_verify' as 'login',
    });

    return res.status(201).json({
      pendingToken,
      purpose: 'email_verify',
      otpSent: true,
      user: { _id: userId, email: emailNorm, displayName: String(displayName).trim() },
    });
  } catch (error) {
    console.error('Register error:', error);
    return res.status(500).json({ error: 'Internal server error' });
  }
}
