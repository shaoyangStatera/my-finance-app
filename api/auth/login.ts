import type { VercelRequest, VercelResponse } from '@vercel/node';
import { connectToDatabase, handleOptions, setCorsHeaders } from '../utils/db';
import { comparePassword, signAccessToken } from '../utils/auth';
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
  const rateKey = `login:${ip}`;

  try {
    const limit = await checkRateLimit(rateKey, RATE_LIMITS.login);
    if (!limit.allowed) {
      return res.status(429).json({
        error: rateLimitErrorMessage(limit.retryAfterSeconds),
        retryAfterSeconds: limit.retryAfterSeconds,
      });
    }

    const { email, password } = req.body ?? {};

    if (!email || !password) {
      return res.status(400).json({ error: 'Email and password are required' });
    }

    const { db } = await connectToDatabase();
    const user = await db.collection('users').findOne({
      email: String(email).toLowerCase().trim(),
      emailVerified: true,
    });

    if (!user || !(await comparePassword(String(password), user.passwordHash))) {
      const failure = await recordRateLimitFailure(rateKey, RATE_LIMITS.login);
      if (!failure.allowed) {
        return res.status(429).json({
          error: rateLimitErrorMessage(failure.retryAfterSeconds),
          retryAfterSeconds: failure.retryAfterSeconds,
        });
      }
      return res.status(401).json({ error: 'Invalid email or password' });
    }

    await clearRateLimit(rateKey);

    const userId = user._id.toString();
    const userPayload = {
      _id: userId,
      email: user.email,
      displayName: user.displayName,
      familyId: user.familyId ?? null,
      familyRole: user.familyRole ?? null,
      onboardingComplete: user.onboardingComplete ?? false,
    };

    // Normal login — issue token directly, no OTP needed
    const token = signAccessToken({
      userId,
      email: user.email,
      displayName: user.displayName,
      familyId: user.familyId ?? undefined,
    });

    return res.status(200).json({ token, user: userPayload });
  } catch (error) {
    console.error('Login error:', error);
    return res.status(500).json({ error: 'Internal server error' });
  }
}
