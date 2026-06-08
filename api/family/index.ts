import type { VercelRequest, VercelResponse } from '@vercel/node';
import { ObjectId } from 'mongodb';
import { connectToDatabase, handleOptions, setCorsHeaders } from '../utils/db';
import { requireAuth } from '../utils/auth';

export default async function handler(req: VercelRequest, res: VercelResponse) {
  setCorsHeaders(res);
  if (handleOptions(req, res)) return;

  if (req.method !== 'GET') return res.status(405).json({ error: 'Method not allowed' });

  let auth;
  try { auth = await requireAuth(req); } catch { return res.status(401).json({ error: 'Unauthorized' }); }
  if (!auth.familyId) return res.status(404).json({ error: 'Not in a family' });

  try {
    const { db } = await connectToDatabase();
    const family = await db.collection('families').findOne({ _id: new ObjectId(auth.familyId) });
    if (!family) return res.status(404).json({ error: 'Family not found' });

    return res.status(200).json({
      _id: family._id.toString(),
      name: family.name,
      inviteCode: family.inviteCode,
      members: family.members ?? [],
      pendingRequests: family.pendingRequests ?? [],
      memberLabels: family.memberLabels ?? {},
      createdAt: family.createdAt,
    });
  } catch (err) {
    console.error('Get family error:', err);
    return res.status(500).json({ error: 'Internal server error' });
  }
}
