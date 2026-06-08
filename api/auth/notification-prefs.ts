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

  const { cpf, investment, expense } = req.body ?? {};
  if (typeof cpf !== 'boolean' || typeof investment !== 'boolean' || typeof expense !== 'boolean') {
    return res.status(400).json({ error: 'cpf, investment, and expense boolean fields are required' });
  }

  try {
    const { db } = await connectToDatabase();
    await db.collection('users').updateOne(
      { _id: new ObjectId(auth.userId) },
      { $set: { notificationPrefs: { cpf, investment, expense } } },
    );
    return res.status(200).json({ message: 'Notification preferences updated.' });
  } catch (err) {
    console.error('Notification prefs error:', err);
    return res.status(500).json({ error: 'Internal server error' });
  }
}
