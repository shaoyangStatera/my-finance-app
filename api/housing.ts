import type { VercelRequest, VercelResponse } from '@vercel/node';
import { connectToDatabase, handleOptions, setCorsHeaders } from './utils/db';
import { requireAuth } from './utils/auth';

export default async function handler(req: VercelRequest, res: VercelResponse) {
  setCorsHeaders(res);
  if (handleOptions(req, res)) return;

  let auth;
  try { auth = await requireAuth(req); } catch { return res.status(401).json({ error: 'Unauthorized' }); }
  if (!auth.familyId) return res.status(403).json({ error: 'Join a family group to access housing data' });

  try {
    const { db } = await connectToDatabase();
    const col = db.collection('housing');

    if (req.method === 'GET') {
      const doc = await col.findOne({ familyId: auth.familyId });
      if (!doc) return res.status(404).json({ error: 'No housing project found' });
      return res.status(200).json({ ...doc, _id: doc._id.toString() });
    }

    if (req.method === 'PUT') {
      const body = req.body ?? {};
      delete body._id;
      await col.updateOne(
        { familyId: auth.familyId },
        { $set: { ...body, familyId: auth.familyId, updatedAt: new Date().toISOString() } },
        { upsert: true },
      );
      const saved = await col.findOne({ familyId: auth.familyId });
      return res.status(200).json({ ...saved, _id: saved!._id.toString() });
    }

    return res.status(405).json({ error: 'Method not allowed' });
  } catch (error) {
    console.error('Housing error:', error);
    return res.status(500).json({ error: 'Internal server error' });
  }
}
