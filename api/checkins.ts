import type { VercelRequest, VercelResponse } from '@vercel/node';
import { ObjectId } from 'mongodb';
// eslint-disable-next-line @typescript-eslint/no-require-imports
const nodeFetch = require('node-fetch') as typeof import('node-fetch').default;
import { connectToDatabase, handleOptions, setCorsHeaders } from './utils/db';
import { requireAuth } from './utils/auth';
import { createEmptyCheckin, normalizeCheckin } from '../lib/types';

// ─── Notification + Push helpers ──────────────────────────────────────────────

type NotifType = 'cpf' | 'investment' | 'expense';

interface NotifPrefDoc {
  notificationPrefs?: { cpf?: boolean; investment?: boolean; expense?: boolean };
}

async function fireNotifications(
  db: Awaited<ReturnType<typeof connectToDatabase>>['db'],
  familyId: string,
  actorUserId: string,
  actorName: string,
  type: NotifType,
  message: string,
) {
  try {
    const family = await db.collection('families').findOne({ _id: new ObjectId(familyId) });
    if (!family) return;

    const now = new Date().toISOString();
    await db.collection('notifications').insertOne({
      familyId,
      actorUserId,
      actorName,
      type,
      message,
      createdAt: now,
      readBy: [actorUserId],
    });

    const expoPushTokens: Record<string, string> = family.expoPushTokens ?? {};
    const members: Array<{ userId: string }> = family.members ?? [];
    const otherMemberIds = members.map((m) => m.userId).filter((uid) => uid !== actorUserId);

    if (otherMemberIds.length === 0) return;

    const userDocs = await db.collection('users').find({
      _id: {
        $in: otherMemberIds
          .map((id) => { try { return new ObjectId(id); } catch { return null; } })
          .filter(Boolean),
      },
    }).toArray();

    const tokens: string[] = [];
    for (const uid of otherMemberIds) {
      const userDoc = userDocs.find((u) => u._id.toString() === uid) as NotifPrefDoc | undefined;
      const prefs = userDoc?.notificationPrefs;
      const prefEnabled = !prefs || prefs[type] !== false;
      const token = expoPushTokens[uid];
      if (prefEnabled && token) tokens.push(token);
    }

    if (tokens.length === 0) return;

    await nodeFetch('https://exp.host/--/api/v2/push/send', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', Accept: 'application/json' },
      body: JSON.stringify(
        tokens.map((to) => ({
          to,
          title: 'Nestworth',
          body: message,
          data: { type, familyId },
        })),
      ),
    }).catch((e: unknown) => console.error('Push send error:', e));
  } catch (e) {
    console.error('fireNotifications error:', e);
  }
}

function detectChangeType(
  prev: Record<string, unknown> | null,
  next: Record<string, unknown>,
): NotifType | null {
  if (!prev) return null;
  const keys: NotifType[] = ['cpf', 'investment', 'expense'];
  for (const k of keys) {
    if (JSON.stringify(prev[k]) !== JSON.stringify(next[k])) return k;
  }
  if (JSON.stringify(prev.ledger) !== JSON.stringify(next.ledger)) return 'expense';
  return null;
}

// ─── GET /api/checkins (list all) ─────────────────────────────────────────────
async function handleList(req: VercelRequest, res: VercelResponse) {
  if (req.method !== 'GET') return res.status(405).json({ error: 'Method not allowed' });

  try { await requireAuth(req); } catch { return res.status(401).json({ error: 'Unauthorized' }); }

  const { db } = await connectToDatabase();
  const checkins = await db
    .collection('monthly_checkins')
    .find({})
    .sort({ monthYear: -1 })
    .toArray();

  return res.status(200).json(checkins.map((c) => ({ ...c, _id: c._id.toString() })));
}

// ─── GET|PUT /api/checkins/:month ─────────────────────────────────────────────
async function handleMonth(req: VercelRequest, res: VercelResponse, month: string) {
  let auth;
  try { auth = await requireAuth(req); } catch { return res.status(401).json({ error: 'Unauthorized' }); }
  if (!auth.familyId) return res.status(403).json({ error: 'Join a family group to access check-ins' });

  if (!/^\d{4}-\d{2}$/.test(month)) {
    return res.status(400).json({ error: 'Invalid month format. Use YYYY-MM.' });
  }

  const { db } = await connectToDatabase();
  const col = db.collection('monthly_checkins');

  if (req.method === 'GET') {
    const existing = await col.findOne({ familyId: auth.familyId, monthYear: month });
    if (!existing) return res.status(200).json(createEmptyCheckin(month, auth.familyId));
    return res.status(200).json(
      normalizeCheckin({ ...existing, monthYear: month, familyId: auth.familyId, _id: existing._id.toString() }),
    );
  }

  if (req.method === 'PUT') {
    const body = req.body ?? {};
    const prevDoc = await col.findOne({ familyId: auth.familyId, monthYear: month });

    const checkin = normalizeCheckin({
      ...body,
      monthYear: month,
      familyId: auth.familyId,
      updatedAt: new Date().toISOString(),
      updatedBy: auth.displayName,
    });
    delete (checkin as { _id?: string })._id;

    await col.updateOne(
      { familyId: auth.familyId, monthYear: month },
      { $set: checkin },
      { upsert: true },
    );

    const saved = await col.findOne({ familyId: auth.familyId, monthYear: month });

    const changeType = detectChangeType(
      prevDoc as Record<string, unknown> | null,
      body as Record<string, unknown>,
    );
    if (changeType) {
      const typeLabel: Record<NotifType, string> = { cpf: 'CPF data', investment: 'investments', expense: 'expenses' };
      const message = `${auth.displayName} updated ${typeLabel[changeType]} for ${month}.`;
      fireNotifications(db, auth.familyId, auth.userId, auth.displayName, changeType, message);
    }

    return res.status(200).json({ ...saved, _id: saved!._id.toString() });
  }

  return res.status(405).json({ error: 'Method not allowed' });
}

// ─── Main dispatcher ──────────────────────────────────────────────────────────
export default async function handler(req: VercelRequest, res: VercelResponse) {
  setCorsHeaders(res);
  if (handleOptions(req, res)) return;

  const month = req.query.month as string | undefined;

  try {
    if (month) {
      return await handleMonth(req, res, month);
    }
    return await handleList(req, res);
  } catch (error) {
    console.error('Checkins handler error:', error);
    return res.status(500).json({ error: 'Internal server error' });
  }
}
