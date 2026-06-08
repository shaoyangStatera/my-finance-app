import type { VercelRequest, VercelResponse } from '@vercel/node';
import { ObjectId } from 'mongodb';
import { connectToDatabase, handleOptions, setCorsHeaders } from '../utils/db';
import { hashPassword, signAccessToken, verifyPendingOTPToken } from '../utils/auth';
import { verifyEmailOtp } from '../utils/email-otp';
import { validateNewPassword } from '../utils/password-policy';
import {
  RATE_LIMITS,
  checkRateLimit,
  clearRateLimit,
  getClientIp,
  rateLimitErrorMessage,
  recordRateLimitFailure,
} from '../utils/rate-limit';

export default async function handler(req: VercelRequest, res: VercelResponse) {
  setCorsHeaders(res);
  if (handleOptions(req, res)) return;

  if (req.method !== 'POST') {
    return res.status(405).json({ error: 'Method not allowed' });
  }

  const ip = getClientIp(req);
  const rateKey = `reset-password:${ip}`;

  try {
    const limit = await checkRateLimit(rateKey, RATE_LIMITS.verify2fa);
    if (!limit.allowed) {
      return res.status(429).json({
        error: rateLimitErrorMessage(limit.retryAfterSeconds),
        retryAfterSeconds: limit.retryAfterSeconds,
      });
    }

    const { pendingToken, code, newPassword } = req.body ?? {};

    if (!pendingToken || !code || !newPassword) {
      return res.status(400).json({ error: 'Verification code, session token, and new password are required' });
    }

    const passwordError = validateNewPassword(String(newPassword));
    if (passwordError) {
      return res.status(400).json({ error: passwordError });
    }

    const pending = verifyPendingOTPToken(String(pendingToken));
    if (!pending || pending.purpose !== 'password_reset') {
      return res.status(401).json({
        error: 'Verification session expired. Please start again.',
      });
    }

    const { db } = await connectToDatabase();
    const userDoc = await db.collection('users').findOne({ _id: new ObjectId(pending.userId) });

    if (!userDoc) {
      return res.status(401).json({ error: 'Invalid verification session' });
    }

    if (!(await verifyEmailOtp(pending.userId, 'password_reset', String(code).trim()))) {
      const failure = await recordRateLimitFailure(rateKey, RATE_LIMITS.verify2fa);
      if (!failure.allowed) {
        return res.status(429).json({
          error: rateLimitErrorMessage(failure.retryAfterSeconds),
          retryAfterSeconds: failure.retryAfterSeconds,
        });
      }
      return res.status(401).json({ error: 'Invalid verification code' });
    }

    const passwordHash = await hashPassword(String(newPassword));
    const now = new Date().toISOString();

    await db.collection('users').updateOne(
      { _id: userDoc._id },
      {
        $set: {
          passwordHash,
          passwordChangedAt: now,
          updatedAt: now,
        },
        $unset: { totpSecret: '' },
      },
    );

    await clearRateLimit(rateKey);

    const token = signAccessToken({
      userId: userDoc._id.toString(),
      email: userDoc.email,
      displayName: userDoc.displayName,
      familyId: userDoc.familyId ?? undefined,
    });

    return res.status(200).json({
      token,
      user: {
        _id: userDoc._id.toString(),
        email: userDoc.email,
        displayName: userDoc.displayName,
        familyId: userDoc.familyId ?? null,
        onboardingComplete: userDoc.onboardingComplete ?? false,
      },
      message: 'Password updated successfully.',
    });
  } catch (error) {
    console.error('Reset password error:', error);
    return res.status(500).json({ error: 'Internal server error' });
  }
}
