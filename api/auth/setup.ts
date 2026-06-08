import type { VercelRequest, VercelResponse } from '@vercel/node';
import { connectToDatabase, handleOptions, setCorsHeaders } from '../utils/db';
import { hashPassword } from '../utils/auth';
import { validateNewPassword } from '../utils/password-policy';

export default async function handler(req: VercelRequest, res: VercelResponse) {
  setCorsHeaders(res);
  if (handleOptions(req, res)) return;

  if (req.method !== 'POST') {
    return res.status(405).json({ error: 'Method not allowed' });
  }

  const setupSecret = process.env.SETUP_SECRET;
  if (!setupSecret) {
    return res.status(503).json({ error: 'Setup is not configured. Set SETUP_SECRET in environment variables.' });
  }

  try {
    const { setupSecret: providedSecret, username, password, displayName, users } = req.body ?? {};

    if (providedSecret !== setupSecret) {
      return res.status(403).json({ error: 'Invalid setup secret' });
    }

    const { db } = await connectToDatabase();
    const existingCount = await db.collection('users').countDocuments();

    if (existingCount > 0) {
      return res.status(409).json({ error: 'Account already exists. Setup can only run once.' });
    }

    let accountList: { username: string; password: string; displayName: string }[];

    if (username && password) {
      accountList = [{
        username: String(username),
        password: String(password),
        displayName: String(displayName ?? 'Admin'),
      }];
    } else if (Array.isArray(users) && users.length > 0) {
      accountList = users;
    } else {
      return res.status(400).json({ error: 'Provide username + password for the shared account.' });
    }

    if (accountList.length > 1) {
      return res.status(400).json({ error: 'Only one shared account is supported.' });
    }

    const u = accountList[0];
    const passwordError = validateNewPassword(u.password);
    if (passwordError) {
      return res.status(400).json({ error: passwordError });
    }

    const now = new Date().toISOString();
    await db.collection('users').insertOne({
      username: u.username.toLowerCase(),
      displayName: u.displayName,
      passwordHash: await hashPassword(u.password),
      passwordChangedAt: now,
      createdAt: now,
    });

    return res.status(201).json({
      message: 'Shared account created. You can now log in.',
    });
  } catch (error) {
    console.error('Setup error:', error);
    return res.status(500).json({ error: 'Internal server error' });
  }
}
