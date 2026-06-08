import type { VercelRequest, VercelResponse } from '@vercel/node';
import { ObjectId } from 'mongodb';
import crypto from 'crypto';
import { connectToDatabase, handleOptions, setCorsHeaders } from '../utils/db';
import { requireAuth, signAccessToken } from '../utils/auth';

function generateInviteCode(): string {
  return crypto.randomBytes(4).toString('hex').toUpperCase(); // e.g. "A3F9C201"
}

export default async function handler(req: VercelRequest, res: VercelResponse) {
  setCorsHeaders(res);
  if (handleOptions(req, res)) return;

  if (req.method !== 'POST') return res.status(405).json({ error: 'Method not allowed' });

  let auth;
  try { auth = await requireAuth(req); } catch { return res.status(401).json({ error: 'Unauthorized' }); }

  try {
    const { db } = await connectToDatabase();
    const userDoc = await db.collection('users').findOne({ _id: new ObjectId(auth.userId) });
    if (!userDoc) return res.status(404).json({ error: 'User not found' });
    if (userDoc.familyId) return res.status(400).json({ error: 'You are already in a family group' });

    const { name } = req.body ?? {};
    if (!name || String(name).trim().length < 2) {
      return res.status(400).json({ error: 'Family name must be at least 2 characters' });
    }

    const inviteCode = generateInviteCode();
    const now = new Date().toISOString();

    const familyResult = await db.collection('families').insertOne({
      name: String(name).trim(),
      inviteCode,
      members: [{
        userId: auth.userId,
        displayName: userDoc.displayName,
        email: userDoc.email,
        role: 'admin',
        joinedAt: now,
      }],
      pendingRequests: [],
      createdAt: now,
    });

    const familyId = familyResult.insertedId.toString();

    await db.collection('users').updateOne(
      { _id: new ObjectId(auth.userId) },
      { $set: { familyId, familyRole: 'admin', onboardingComplete: true } },
    );

    // Re-issue token with familyId
    const token = signAccessToken({
      userId: auth.userId,
      email: userDoc.email,
      displayName: userDoc.displayName,
      familyId,
    });

    return res.status(201).json({
      token,
      family: { _id: familyId, name: String(name).trim(), inviteCode },
      user: {
        _id: auth.userId,
        email: userDoc.email,
        displayName: userDoc.displayName,
        familyId,
        familyRole: 'admin',
        onboardingComplete: true,
      },
    });
  } catch (err) {
    console.error('Create family error:', err);
    return res.status(500).json({ error: 'Internal server error' });
  }
}
