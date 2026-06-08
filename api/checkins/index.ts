import type { VercelRequest, VercelResponse } from '@vercel/node';
import { connectToDatabase, handleOptions, setCorsHeaders } from '../utils/db';
import { requireAuth } from '../utils/auth';

export default async function handler(req: VercelRequest, res: VercelResponse) {
  setCorsHeaders(res);
  if (handleOptions(req, res)) return;

  try {
    await requireAuth(req);
  } catch {
    return res.status(401).json({ error: 'Unauthorized' });
  }

  if (req.method !== 'GET') {
    return res.status(405).json({ error: 'Method not allowed' });
  }

  try {
    const { db } = await connectToDatabase();
    const checkins = await db
      .collection('monthly_checkins')
      .find({})
      .sort({ monthYear: -1 })
      .toArray();

    return res.status(200).json(
      checkins.map((c) => ({
        ...c,
        _id: c._id.toString(),
      })),
    );
  } catch (error) {
    console.error('Fetch checkins error:', error);
    return res.status(500).json({ error: 'Internal server error' });
  }
}
