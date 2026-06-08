import type { VercelRequest, VercelResponse } from '@vercel/node';
import { ObjectId } from 'mongodb';
import { connectToDatabase, handleOptions, setCorsHeaders } from '../utils/db';
import { requireAuth, signAccessToken } from '../utils/auth';

export default async function handler(req: VercelRequest, res: VercelResponse) {
  setCorsHeaders(res);
  if (handleOptions(req, res)) return;

  if (req.method !== 'POST') return res.status(405).json({ error: 'Method not allowed' });

  let auth;
  try { auth = await requireAuth(req); } catch { return res.status(401).json({ error: 'Unauthorized' }); }
  if (!auth.familyId) return res.status(403).json({ error: 'You are not in a family group' });

  try {
    const { db } = await connectToDatabase();
    const family = await db.collection('families').findOne({ _id: new ObjectId(auth.familyId) });
    if (!family) return res.status(404).json({ error: 'Family not found' });

    const currentAdminEntry = family.members?.find(
      (m: { userId: string; role: string }) => m.userId === auth.userId && m.role === 'admin',
    );
    if (!currentAdminEntry) return res.status(403).json({ error: 'Only family admins can transfer admin role' });

    const { newAdminUserId } = req.body ?? {};
    if (!newAdminUserId) return res.status(400).json({ error: 'newAdminUserId is required' });
    if (newAdminUserId === auth.userId) return res.status(400).json({ error: 'You are already the admin' });

    const targetMember = family.members?.find(
      (m: { userId: string }) => m.userId === newAdminUserId,
    );
    if (!targetMember) return res.status(404).json({ error: 'Target user is not a member of this family' });

    // Swap roles
    await db.collection('families').updateOne(
      { _id: family._id, 'members.userId': auth.userId },
      { $set: { 'members.$.role': 'member' } },
    );
    await db.collection('families').updateOne(
      { _id: family._id, 'members.userId': newAdminUserId },
      { $set: { 'members.$.role': 'admin' } },
    );

    // Update user records
    await db.collection('users').updateOne(
      { _id: new ObjectId(auth.userId) },
      { $set: { familyRole: 'member' } },
    );
    await db.collection('users').updateOne(
      { _id: new ObjectId(newAdminUserId) },
      { $set: { familyRole: 'admin' } },
    );

    // Re-issue token for current user with updated role
    const userDoc = await db.collection('users').findOne({ _id: new ObjectId(auth.userId) });
    const token = signAccessToken({
      userId: auth.userId,
      email: auth.email,
      displayName: userDoc?.displayName ?? auth.displayName,
      familyId: auth.familyId,
    });

    return res.status(200).json({
      token,
      message: `${targetMember.displayName} is now the family admin.`,
      user: {
        _id: auth.userId,
        email: auth.email,
        displayName: userDoc?.displayName ?? auth.displayName,
        familyId: auth.familyId,
        familyRole: 'member',
        onboardingComplete: userDoc?.onboardingComplete ?? true,
      },
    });
  } catch (err) {
    console.error('Transfer admin error:', err);
    return res.status(500).json({ error: 'Internal server error' });
  }
}
