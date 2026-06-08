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

    const adminEntry = family.members?.find(
      (m: { userId: string; role: string }) => m.userId === auth.userId && m.role === 'admin',
    );
    if (!adminEntry) return res.status(403).json({ error: 'Only family admins can set member labels' });

    const { targetUserId, label } = req.body ?? {};
    if (!targetUserId) return res.status(400).json({ error: 'targetUserId is required' });

    const isMember = family.members?.some((m: { userId: string }) => m.userId === targetUserId);
    if (!isMember) return res.status(404).json({ error: 'Target user is not a member of this family' });

    const labelKey = `memberLabels.${targetUserId}`;

    if (!label || String(label).trim() === '') {
      // Remove label
      await db.collection('families').updateOne(
        { _id: family._id },
        { $unset: { [labelKey]: '' } },
      );
    } else {
      await db.collection('families').updateOne(
        { _id: family._id },
        { $set: { [labelKey]: String(label).trim() } },
      );
    }

    return res.status(200).json({ message: 'Label updated.' });
  } catch (err) {
    console.error('Set label error:', err);
    return res.status(500).json({ error: 'Internal server error' });
  }
}
