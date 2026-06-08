import type { VercelRequest, VercelResponse } from '@vercel/node';
import { ObjectId } from 'mongodb';
import { connectToDatabase, handleOptions, setCorsHeaders } from '../utils/db';
import { requireAuth } from '../utils/auth';

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

    const { inviteCode } = req.body ?? {};
    if (!inviteCode) return res.status(400).json({ error: 'Invite code is required' });

    const family = await db.collection('families').findOne({
      inviteCode: String(inviteCode).toUpperCase().trim(),
    });
    if (!family) return res.status(404).json({ error: 'Invalid invite code' });

    // Check not already a member or pending
    const alreadyMember = family.members?.some((m: { userId: string }) => m.userId === auth.userId);
    const alreadyPending = family.pendingRequests?.some((r: { userId: string }) => r.userId === auth.userId);
    if (alreadyMember) return res.status(400).json({ error: 'Already a member of this family' });
    if (alreadyPending) return res.status(400).json({ error: 'Join request already pending' });

    // Add to pending requests
    const requestEntry = {
      userId: auth.userId,
      displayName: userDoc.displayName,
      email: userDoc.email,
      requestedAt: new Date().toISOString(),
    };

    await db.collection('families').updateOne(
      { _id: family._id },
      { $push: { pendingRequests: requestEntry } as Record<string, unknown> },
    );

    return res.status(200).json({
      message: 'Join request sent. Waiting for admin approval.',
      familyName: family.name,
    });
  } catch (err) {
    console.error('Join family error:', err);
    return res.status(500).json({ error: 'Internal server error' });
  }
}
