import crypto from 'crypto';
import bcrypt from 'bcryptjs';
import { ObjectId } from 'mongodb';
import { connectToDatabase } from './db';
import { OTP_EXPIRY_MS, type OtpPurpose } from './email-config';
import { sendOtpEmail } from './email';

function generateSixDigitCode(): string {
  return String(crypto.randomInt(0, 1_000_000)).padStart(6, '0');
}

export async function createAndSendOtp(
  userId: string,
  purpose: OtpPurpose,
  recipientEmail: string | string[],
): Promise<void> {
  const code = generateSixDigitCode();
  const codeHash = await bcrypt.hash(code, 10);
  const expiresAt = new Date(Date.now() + OTP_EXPIRY_MS);

  const { db } = await connectToDatabase();
  await db.collection('email_otps').deleteMany({ userId, purpose });
  await db.collection('email_otps').insertOne({
    userId,
    purpose,
    codeHash,
    expiresAt,
    createdAt: new Date(),
  });

  await sendOtpEmail(recipientEmail, code, purpose);
}

export async function verifyEmailOtp(
  userId: string,
  purpose: OtpPurpose,
  code: string,
): Promise<boolean> {
  if (!/^\d{6}$/.test(code)) return false;

  const { db } = await connectToDatabase();
  const record = await db.collection('email_otps').findOne({
    userId,
    purpose,
    expiresAt: { $gt: new Date() },
  });

  if (!record) return false;

  const valid = await bcrypt.compare(code, record.codeHash);
  if (valid) {
    await db.collection('email_otps').deleteOne({ _id: record._id });
  }

  return valid;
}

export async function clearUserOtps(userId: string): Promise<void> {
  const { db } = await connectToDatabase();
  await db.collection('email_otps').deleteMany({ userId });
}

export { ObjectId };
