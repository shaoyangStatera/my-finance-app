import type { VercelRequest, VercelResponse } from '@vercel/node';
import { ObjectId } from 'mongodb';
import { connectToDatabase, handleOptions, setCorsHeaders } from '../lib/server/db';
import { requireAuth } from '../lib/server/auth';

export default async function handler(req: VercelRequest, res: VercelResponse) {
  setCorsHeaders(res);
  if (handleOptions(req, res)) return;

  let auth;
  try { auth = await requireAuth(req); } catch { return res.status(401).json({ error: 'Unauthorized' }); }
  if (!auth.familyId) return res.status(200).json([]);

  const { db } = await connectToDatabase();
  const col = db.collection('notifications');

  if (req.method === 'GET') {
    try {
      const limit = Math.min(Number(req.query.limit ?? 50), 100);
      const notifications = await col
        .find({ familyId: auth.familyId })
        .sort({ createdAt: -1 })
        .limit(limit)
        .toArray();

      return res.status(200).json(
        notifications.map((n) => ({
          ...n,
          _id: n._id.toString(),
          isRead: Array.isArray(n.readBy) && n.readBy.includes(auth.userId),
        })),
      );
    } catch (err) {
      console.error('Get notifications error:', err);
      return res.status(500).json({ error: 'Internal server error' });
    }
  }

  if (req.method === 'POST') {
    // Mark notifications as read
    const { ids } = req.body ?? {};
    try {
      if (Array.isArray(ids) && ids.length > 0) {
        const objectIds = ids.map((id: string) => new ObjectId(id));
        await col.updateMany(
          { _id: { $in: objectIds }, familyId: auth.familyId },
          { $addToSet: { readBy: auth.userId } },
        );
      } else {
        // Mark all as read
        await col.updateMany(
          { familyId: auth.familyId },
          { $addToSet: { readBy: auth.userId } },
        );
      }
      return res.status(200).json({ message: 'Marked as read.' });
    } catch (err) {
      console.error('Mark read error:', err);
      return res.status(500).json({ error: 'Internal server error' });
    }
  }

  return res.status(405).json({ error: 'Method not allowed' });
}
