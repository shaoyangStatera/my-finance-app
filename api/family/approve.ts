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
  if (!auth.familyId) return res.status(403).json({ error: 'You are not in a family group' });

  try {
    const { db } = await connectToDatabase();

    const family = await db.collection('families').findOne({ _id: new ObjectId(auth.familyId) });
    if (!family) return res.status(404).json({ error: 'Family not found' });

    // Must be admin
    const adminEntry = family.members?.find(
      (m: { userId: string; role: string }) => m.userId === auth.userId && m.role === 'admin',
    );
    if (!adminEntry) return res.status(403).json({ error: 'Only family admins can approve requests' });

    const { userId, action } = req.body ?? {};
    if (!userId || !['approve', 'reject'].includes(action)) {
      return res.status(400).json({ error: 'userId and action (approve|reject) are required' });
    }

    const pendingEntry = family.pendingRequests?.find((r: { userId: string }) => r.userId === userId);
    if (!pendingEntry) return res.status(404).json({ error: 'No pending request from this user' });

    // Remove from pending
    await db.collection('families').updateOne(
      { _id: family._id },
      { $pull: { pendingRequests: { userId } } as Record<string, unknown> },
    );

    if (action === 'approve') {
      const now = new Date().toISOString();
      const memberEntry = {
        userId: pendingEntry.userId,
        displayName: pendingEntry.displayName,
        email: pendingEntry.email,
        role: 'member',
        joinedAt: now,
      };
      await db.collection('families').updateOne(
        { _id: family._id },
        { $push: { members: memberEntry } as Record<string, unknown> },
      );
      await db.collection('users').updateOne(
        { _id: new ObjectId(pendingEntry.userId) },
        { $set: { familyId: auth.familyId, familyRole: 'member', onboardingComplete: true } },
      );
      return res.status(200).json({ message: `${pendingEntry.displayName} approved and added to family.` });
    }

    return res.status(200).json({ message: `Request from ${pendingEntry.displayName} rejected.` });
  } catch (err) {
    console.error('Approve family error:', err);
    return res.status(500).json({ error: 'Internal server error' });
  }
}
