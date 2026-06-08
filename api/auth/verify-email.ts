import type { VercelRequest, VercelResponse } from '@vercel/node';
import { ObjectId } from 'mongodb';
import { connectToDatabase, handleOptions, setCorsHeaders } from '../utils/db';
import { signAccessToken, verifyPendingOTPToken } from '../utils/auth';
import { verifyEmailOtp } from '../utils/email-otp';
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
  const rateKey = `verify-email:${ip}`;

  try {
    const limit = await checkRateLimit(rateKey, RATE_LIMITS.verify2fa);
    if (!limit.allowed) {
      return res.status(429).json({
        error: rateLimitErrorMessage(limit.retryAfterSeconds),
        retryAfterSeconds: limit.retryAfterSeconds,
      });
    }

    const { pendingToken, code } = req.body ?? {};
    if (!pendingToken || !code) {
      return res.status(400).json({ error: 'Token and code are required' });
    }

    const pending = verifyPendingOTPToken(String(pendingToken));
    if (!pending || pending.purpose !== ('email_verify' as 'login')) {
      return res.status(401).json({ error: 'Verification session expired. Please register again.' });
    }

    if (!(await verifyEmailOtp(pending.userId, 'email_verify' as 'login', String(code).trim()))) {
      const failure = await recordRateLimitFailure(rateKey, RATE_LIMITS.verify2fa);
      if (!failure.allowed) {
        return res.status(429).json({
          error: rateLimitErrorMessage(failure.retryAfterSeconds),
          retryAfterSeconds: failure.retryAfterSeconds,
        });
      }
      return res.status(401).json({ error: 'Invalid verification code' });
    }

    await clearRateLimit(rateKey);

    const { db } = await connectToDatabase();
    await db.collection('users').updateOne(
      { _id: new ObjectId(pending.userId) },
      { $set: { emailVerified: true } },
    );

    const userDoc = await db.collection('users').findOne({ _id: new ObjectId(pending.userId) });
    if (!userDoc) return res.status(404).json({ error: 'User not found' });

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
    });
  } catch (error) {
    console.error('Verify email error:', error);
    return res.status(500).json({ error: 'Internal server error' });
  }
}
