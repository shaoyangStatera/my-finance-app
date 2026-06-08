import type { VercelRequest, VercelResponse } from '@vercel/node';
import { ObjectId } from 'mongodb';
import { connectToDatabase, handleOptions, setCorsHeaders } from './utils/db';
import { requireAuth } from './utils/auth';

export default async function handler(req: VercelRequest, res: VercelResponse) {
  setCorsHeaders(res);
  if (handleOptions(req, res)) return;

  if (req.method !== 'POST') return res.status(405).json({ error: 'Method not allowed' });

  let auth;
  try { auth = await requireAuth(req); } catch { return res.status(401).json({ error: 'Unauthorized' }); }
  if (!auth.familyId) return res.status(200).json({ message: 'No family — token not stored' });

  const { token } = req.body ?? {};
  if (!token || typeof token !== 'string') return res.status(400).json({ error: 'token is required' });

  try {
    const { db } = await connectToDatabase();
    const tokenKey = `expoPushTokens.${auth.userId}`;

    await db.collection('families').updateOne(
      { _id: new ObjectId(auth.familyId) },
      { $set: { [tokenKey]: token } },
    );

    return res.status(200).json({ message: 'Push token registered.' });
  } catch (err) {
    console.error('Push token error:', err);
    return res.status(500).json({ error: 'Internal server error' });
  }
}
