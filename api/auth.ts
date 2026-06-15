import type { VercelRequest, VercelResponse } from '@vercel/node';
import { ObjectId } from 'mongodb';
import { connectToDatabase, handleOptions, setCorsHeaders } from '../lib/server/db';
import {
  comparePassword,
  hashPassword,
  requireAuth,
  signAccessToken,
  signPendingOTPToken,
  verifyAccessToken,
  verifyPendingOTPToken,
} from '../lib/server/auth';
import { createAndSendOtp, verifyEmailOtp } from '../lib/server/email-otp';
import { PASSWORD_MIN_LENGTH } from '../lib/server/email-config';
import { validateNewPassword } from '../lib/server/password-policy';
import {
  RATE_LIMITS,
  checkRateLimit,
  clearRateLimit,
  getClientIp,
  rateLimitErrorMessage,
  recordRateLimitFailure,
} from '../lib/server/rate-limit';
import { REGISTRATION_ENABLED, REGISTRATION_DISABLED_MESSAGE } from '../lib/registration';

const EMAIL_RE = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;

// ─── login ───────────────────────────────────────────────────────────────────
async function handleLogin(req: VercelRequest, res: VercelResponse) {
  if (req.method !== 'POST') return res.status(405).json({ error: 'Method not allowed' });

  const ip = getClientIp(req);
  const rateKey = `login:${ip}`;

  const limit = await checkRateLimit(rateKey, RATE_LIMITS.login);
  if (!limit.allowed) {
    return res.status(429).json({
      error: rateLimitErrorMessage(limit.retryAfterSeconds),
      retryAfterSeconds: limit.retryAfterSeconds,
    });
  }

  const { email, password } = req.body ?? {};
  if (!email || !password) return res.status(400).json({ error: 'Email and password are required' });

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
  const token = signAccessToken({
    userId,
    email: user.email,
    displayName: user.displayName,
    familyId: user.familyId ?? undefined,
  });

  return res.status(200).json({
    token,
    user: {
      _id: userId,
      email: user.email,
      displayName: user.displayName,
      familyId: user.familyId ?? null,
      familyRole: user.familyRole ?? null,
      onboardingComplete: user.onboardingComplete ?? false,
    },
  });
}

// ─── register ────────────────────────────────────────────────────────────────
async function handleRegister(req: VercelRequest, res: VercelResponse) {
  if (req.method !== 'POST') return res.status(405).json({ error: 'Method not allowed' });

  if (!REGISTRATION_ENABLED) {
    return res.status(403).json({ error: REGISTRATION_DISABLED_MESSAGE });
  }

  const ip = getClientIp(req);
  const rateKey = `register:${ip}`;

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
  if (!EMAIL_RE.test(emailNorm)) return res.status(400).json({ error: 'Invalid email address' });
  if (String(displayName).trim().length < 2) return res.status(400).json({ error: 'Display name must be at least 2 characters' });
  if (String(password).length < PASSWORD_MIN_LENGTH) {
    return res.status(400).json({ error: `Password must be at least ${PASSWORD_MIN_LENGTH} characters` });
  }

  const { db } = await connectToDatabase();
  const existing = await db.collection('users').findOne({ email: emailNorm });
  if (existing) {
    await recordRateLimitFailure(rateKey, RATE_LIMITS.login);
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
}

// ─── setup ───────────────────────────────────────────────────────────────────
async function handleSetup(req: VercelRequest, res: VercelResponse) {
  if (req.method !== 'POST') return res.status(405).json({ error: 'Method not allowed' });

  const setupSecret = process.env.SETUP_SECRET;
  if (!setupSecret) {
    return res.status(503).json({ error: 'Setup is not configured. Set SETUP_SECRET in environment variables.' });
  }

  const { setupSecret: providedSecret, username, password, displayName, users } = req.body ?? {};
  if (providedSecret !== setupSecret) return res.status(403).json({ error: 'Invalid setup secret' });

  const { db } = await connectToDatabase();
  const existingCount = await db.collection('users').countDocuments();
  if (existingCount > 0) return res.status(409).json({ error: 'Account already exists. Setup can only run once.' });

  let accountList: { username: string; password: string; displayName: string }[];
  if (username && password) {
    accountList = [{ username: String(username), password: String(password), displayName: String(displayName ?? 'Admin') }];
  } else if (Array.isArray(users) && users.length > 0) {
    accountList = users;
  } else {
    return res.status(400).json({ error: 'Provide username + password for the shared account.' });
  }

  if (accountList.length > 1) return res.status(400).json({ error: 'Only one shared account is supported.' });

  const u = accountList[0];
  const passwordError = validateNewPassword(u.password);
  if (passwordError) return res.status(400).json({ error: passwordError });

  const now = new Date().toISOString();
  await db.collection('users').insertOne({
    username: u.username.toLowerCase(),
    displayName: u.displayName,
    passwordHash: await hashPassword(u.password),
    passwordChangedAt: now,
    createdAt: now,
  });

  return res.status(201).json({ message: 'Shared account created. You can now log in.' });
}

// ─── verify-email ─────────────────────────────────────────────────────────────
async function handleVerifyEmail(req: VercelRequest, res: VercelResponse) {
  if (req.method !== 'POST') return res.status(405).json({ error: 'Method not allowed' });

  const ip = getClientIp(req);
  const rateKey = `verify-email:${ip}`;

  const limit = await checkRateLimit(rateKey, RATE_LIMITS.verify2fa);
  if (!limit.allowed) {
    return res.status(429).json({
      error: rateLimitErrorMessage(limit.retryAfterSeconds),
      retryAfterSeconds: limit.retryAfterSeconds,
    });
  }

  const { pendingToken, code } = req.body ?? {};
  if (!pendingToken || !code) return res.status(400).json({ error: 'Token and code are required' });

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
}

// ─── verify-otp ───────────────────────────────────────────────────────────────
async function handleVerifyOtp(req: VercelRequest, res: VercelResponse) {
  if (req.method !== 'POST') return res.status(405).json({ error: 'Method not allowed' });

  const ip = getClientIp(req);
  const rateKey = `verify2fa:${ip}`;

  const limit = await checkRateLimit(rateKey, RATE_LIMITS.verify2fa);
  if (!limit.allowed) {
    return res.status(429).json({
      error: rateLimitErrorMessage(limit.retryAfterSeconds),
      retryAfterSeconds: limit.retryAfterSeconds,
    });
  }

  const { pendingToken, code } = req.body ?? {};
  if (!pendingToken || !code) return res.status(400).json({ error: 'Verification code and session token are required' });

  const pending = verifyPendingOTPToken(String(pendingToken));
  if (!pending || pending.purpose !== 'login') {
    return res.status(401).json({ error: 'Verification session expired. Please sign in again.' });
  }

  const { db } = await connectToDatabase();
  const userDoc = await db.collection('users').findOne({ _id: new ObjectId(pending.userId) });
  if (!userDoc) return res.status(401).json({ error: 'Invalid verification session' });

  if (!(await verifyEmailOtp(pending.userId, 'login', String(code).trim()))) {
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
      familyRole: userDoc.familyRole ?? null,
      onboardingComplete: userDoc.onboardingComplete ?? false,
    },
  });
}

// ─── reset-password ───────────────────────────────────────────────────────────
async function handleResetPassword(req: VercelRequest, res: VercelResponse) {
  if (req.method !== 'POST') return res.status(405).json({ error: 'Method not allowed' });

  const ip = getClientIp(req);
  const rateKey = `reset-password:${ip}`;

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
  if (passwordError) return res.status(400).json({ error: passwordError });

  const pending = verifyPendingOTPToken(String(pendingToken));
  if (!pending || pending.purpose !== 'password_reset') {
    return res.status(401).json({ error: 'Verification session expired. Please start again.' });
  }

  const { db } = await connectToDatabase();
  const userDoc = await db.collection('users').findOne({ _id: new ObjectId(pending.userId) });
  if (!userDoc) return res.status(401).json({ error: 'Invalid verification session' });

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
      $set: { passwordHash, passwordChangedAt: now, updatedAt: now },
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
}

// ─── request-email-change ────────────────────────────────────────────────────
async function handleRequestEmailChange(req: VercelRequest, res: VercelResponse) {
  if (req.method !== 'POST') return res.status(405).json({ error: 'Method not allowed' });

  let auth;
  try { auth = await requireAuth(req); } catch { return res.status(401).json({ error: 'Unauthorized' }); }

  const { newEmail } = req.body ?? {};
  if (!newEmail || !EMAIL_RE.test(String(newEmail))) {
    return res.status(400).json({ error: 'A valid new email address is required' });
  }

  const emailNorm = String(newEmail).toLowerCase().trim();

  const { db } = await connectToDatabase();

  // Reject if email is same as current
  const currentUser = await db.collection('users').findOne({ _id: new ObjectId(auth.userId) });
  if (!currentUser) return res.status(404).json({ error: 'User not found' });
  if (currentUser.email === emailNorm) {
    return res.status(400).json({ error: 'New email must be different from your current email' });
  }

  // Reject if already taken by another verified account
  const existing = await db.collection('users').findOne({ email: emailNorm, emailVerified: true });
  if (existing) return res.status(409).json({ error: 'This email is already in use' });

  // Store pending email change on the user document
  await db.collection('users').updateOne(
    { _id: new ObjectId(auth.userId) },
    { $set: { pendingEmail: emailNorm } },
  );

  // Send OTP to the NEW email address to prove ownership
  await createAndSendOtp(auth.userId, 'email_change', emailNorm);

  return res.status(200).json({ message: `Verification code sent to ${emailNorm}` });
}

// ─── confirm-email-change ─────────────────────────────────────────────────────
async function handleConfirmEmailChange(req: VercelRequest, res: VercelResponse) {
  if (req.method !== 'POST') return res.status(405).json({ error: 'Method not allowed' });

  let auth;
  try { auth = await requireAuth(req); } catch { return res.status(401).json({ error: 'Unauthorized' }); }

  const { code } = req.body ?? {};
  if (!code) return res.status(400).json({ error: 'Verification code is required' });

  const { db } = await connectToDatabase();
  const userDoc = await db.collection('users').findOne({ _id: new ObjectId(auth.userId) });
  if (!userDoc) return res.status(404).json({ error: 'User not found' });
  if (!userDoc.pendingEmail) return res.status(400).json({ error: 'No pending email change found. Please start again.' });

  const valid = await verifyEmailOtp(auth.userId, 'email_change', String(code).trim());
  if (!valid) return res.status(400).json({ error: 'Invalid or expired code' });

  const newEmail = userDoc.pendingEmail;

  // Final uniqueness check in case another user grabbed it while OTP was pending
  const taken = await db.collection('users').findOne({
    email: newEmail,
    emailVerified: true,
    _id: { $ne: new ObjectId(auth.userId) },
  });
  if (taken) return res.status(409).json({ error: 'This email was just taken by another account. Please use a different email.' });

  await db.collection('users').updateOne(
    { _id: new ObjectId(auth.userId) },
    { $set: { email: newEmail, updatedAt: new Date().toISOString() }, $unset: { pendingEmail: '' } },
  );

  const token = signAccessToken({
    userId: auth.userId,
    email: newEmail,
    displayName: userDoc.displayName,
    familyId: userDoc.familyId ?? undefined,
  });

  return res.status(200).json({
    token,
    user: {
      _id: auth.userId,
      email: newEmail,
      displayName: userDoc.displayName,
      familyId: userDoc.familyId ?? null,
      familyRole: userDoc.familyRole ?? null,
      onboardingComplete: userDoc.onboardingComplete ?? false,
    },
    message: 'Email updated successfully.',
  });
}

// ─── notification-prefs ───────────────────────────────────────────────────────
async function handleNotificationPrefs(req: VercelRequest, res: VercelResponse) {
  if (req.method !== 'POST') return res.status(405).json({ error: 'Method not allowed' });

  let auth;
  try { auth = await requireAuth(req); } catch { return res.status(401).json({ error: 'Unauthorized' }); }

  const { cpf, investment, expense } = req.body ?? {};
  if (typeof cpf !== 'boolean' || typeof investment !== 'boolean' || typeof expense !== 'boolean') {
    return res.status(400).json({ error: 'cpf, investment, and expense boolean fields are required' });
  }

  const { db } = await connectToDatabase();
  await db.collection('users').updateOne(
    { _id: new ObjectId(auth.userId) },
    { $set: { notificationPrefs: { cpf, investment, expense } } },
  );
  return res.status(200).json({ message: 'Notification preferences updated.' });
}

// ─── Main dispatcher ──────────────────────────────────────────────────────────
export default async function handler(req: VercelRequest, res: VercelResponse) {
  setCorsHeaders(res);
  if (handleOptions(req, res)) return;

  // Suppress unused import warning — verifyAccessToken may be used by callers
  void verifyAccessToken;

  const action = req.query.action as string | undefined;

  try {
    switch (action) {
      case 'login':            return await handleLogin(req, res);
      case 'register':         return await handleRegister(req, res);
      case 'setup':            return await handleSetup(req, res);
      case 'verify-email':     return await handleVerifyEmail(req, res);
      case 'verify-otp':       return await handleVerifyOtp(req, res);
      case 'reset-password':          return await handleResetPassword(req, res);
      case 'notification-prefs':      return await handleNotificationPrefs(req, res);
      case 'request-email-change':    return await handleRequestEmailChange(req, res);
      case 'confirm-email-change':    return await handleConfirmEmailChange(req, res);
      default:
        return res.status(404).json({ error: 'Unknown auth action' });
    }
  } catch (error) {
    console.error(`Auth handler error [${action}]:`, error);
    return res.status(500).json({ error: 'Internal server error' });
  }
}
