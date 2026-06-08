import type { VercelRequest, VercelResponse } from '@vercel/node';
import { ObjectId } from 'mongodb';
import crypto from 'crypto';
import { connectToDatabase, handleOptions, setCorsHeaders } from './utils/db';
import { requireAuth, signAccessToken } from './utils/auth';
import { sendFamilyInviteEmail } from './utils/email';

function generateInviteCode(): string {
  return crypto.randomBytes(4).toString('hex').toUpperCase();
}

// ─── GET /api/family (index) ──────────────────────────────────────────────────
async function handleIndex(req: VercelRequest, res: VercelResponse) {
  if (req.method !== 'GET') return res.status(405).json({ error: 'Method not allowed' });

  let auth;
  try { auth = await requireAuth(req); } catch { return res.status(401).json({ error: 'Unauthorized' }); }
  if (!auth.familyId) return res.status(404).json({ error: 'Not in a family' });

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
}

// ─── POST /api/family/create ──────────────────────────────────────────────────
async function handleCreate(req: VercelRequest, res: VercelResponse) {
  if (req.method !== 'POST') return res.status(405).json({ error: 'Method not allowed' });

  let auth;
  try { auth = await requireAuth(req); } catch { return res.status(401).json({ error: 'Unauthorized' }); }

  const { db } = await connectToDatabase();
  const userDoc = await db.collection('users').findOne({ _id: new ObjectId(auth.userId) });
  if (!userDoc) return res.status(404).json({ error: 'User not found' });
  if (userDoc.familyId) return res.status(400).json({ error: 'You are already in a family group' });

  const { name } = req.body ?? {};
  if (!name || String(name).trim().length < 2) {
    return res.status(400).json({ error: 'Family name must be at least 2 characters' });
  }

  const inviteCode = generateInviteCode();
  const now = new Date().toISOString();

  const familyResult = await db.collection('families').insertOne({
    name: String(name).trim(),
    inviteCode,
    members: [{
      userId: auth.userId,
      displayName: userDoc.displayName,
      email: userDoc.email,
      role: 'admin',
      joinedAt: now,
    }],
    pendingRequests: [],
    createdAt: now,
  });

  const familyId = familyResult.insertedId.toString();

  await db.collection('users').updateOne(
    { _id: new ObjectId(auth.userId) },
    { $set: { familyId, familyRole: 'admin', onboardingComplete: true } },
  );

  const token = signAccessToken({
    userId: auth.userId,
    email: userDoc.email,
    displayName: userDoc.displayName,
    familyId,
  });

  return res.status(201).json({
    token,
    family: { _id: familyId, name: String(name).trim(), inviteCode },
    user: {
      _id: auth.userId,
      email: userDoc.email,
      displayName: userDoc.displayName,
      familyId,
      familyRole: 'admin',
      onboardingComplete: true,
    },
  });
}

// ─── POST /api/family/join ────────────────────────────────────────────────────
async function handleJoin(req: VercelRequest, res: VercelResponse) {
  if (req.method !== 'POST') return res.status(405).json({ error: 'Method not allowed' });

  let auth;
  try { auth = await requireAuth(req); } catch { return res.status(401).json({ error: 'Unauthorized' }); }

  const { db } = await connectToDatabase();
  const userDoc = await db.collection('users').findOne({ _id: new ObjectId(auth.userId) });
  if (!userDoc) return res.status(404).json({ error: 'User not found' });
  if (userDoc.familyId) return res.status(400).json({ error: 'You are already in a family group' });

  const { inviteCode } = req.body ?? {};
  if (!inviteCode) return res.status(400).json({ error: 'Invite code is required' });

  const family = await db.collection('families').findOne({
    inviteCode: String(inviteCode).toUpperCase().trim(),
  });
  if (!family) return res.status(404).json({ error: 'Invalid invite code' });

  const alreadyMember = family.members?.some((m: { userId: string }) => m.userId === auth.userId);
  const alreadyPending = family.pendingRequests?.some((r: { userId: string }) => r.userId === auth.userId);
  if (alreadyMember) return res.status(400).json({ error: 'Already a member of this family' });
  if (alreadyPending) return res.status(400).json({ error: 'Join request already pending' });

  const requestEntry = {
    userId: auth.userId,
    displayName: userDoc.displayName,
    email: userDoc.email,
    requestedAt: new Date().toISOString(),
  };

  await db.collection('families').updateOne(
    { _id: family._id },
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    { $push: { pendingRequests: requestEntry } as any },
  );

  return res.status(200).json({
    message: 'Join request sent. Waiting for admin approval.',
    familyName: family.name,
  });
}

// ─── POST /api/family/approve ─────────────────────────────────────────────────
async function handleApprove(req: VercelRequest, res: VercelResponse) {
  if (req.method !== 'POST') return res.status(405).json({ error: 'Method not allowed' });

  let auth;
  try { auth = await requireAuth(req); } catch { return res.status(401).json({ error: 'Unauthorized' }); }
  if (!auth.familyId) return res.status(403).json({ error: 'You are not in a family group' });

  const { db } = await connectToDatabase();
  const family = await db.collection('families').findOne({ _id: new ObjectId(auth.familyId) });
  if (!family) return res.status(404).json({ error: 'Family not found' });

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

  await db.collection('families').updateOne(
    { _id: family._id },
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    { $pull: { pendingRequests: { userId } } as any },
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
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      { $push: { members: memberEntry } as any },
    );
    await db.collection('users').updateOne(
      { _id: new ObjectId(pendingEntry.userId) },
      { $set: { familyId: auth.familyId, familyRole: 'member', onboardingComplete: true } },
    );
    return res.status(200).json({ message: `${pendingEntry.displayName} approved and added to family.` });
  }

  return res.status(200).json({ message: `Request from ${pendingEntry.displayName} rejected.` });
}

// ─── POST /api/family/set-label ───────────────────────────────────────────────
async function handleSetLabel(req: VercelRequest, res: VercelResponse) {
  if (req.method !== 'POST') return res.status(405).json({ error: 'Method not allowed' });

  let auth;
  try { auth = await requireAuth(req); } catch { return res.status(401).json({ error: 'Unauthorized' }); }
  if (!auth.familyId) return res.status(403).json({ error: 'You are not in a family group' });

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
    await db.collection('families').updateOne({ _id: family._id }, { $unset: { [labelKey]: '' } });
  } else {
    await db.collection('families').updateOne({ _id: family._id }, { $set: { [labelKey]: String(label).trim() } });
  }

  return res.status(200).json({ message: 'Label updated.' });
}

// ─── POST /api/family/transfer-admin (promotes target; caller keeps admin role) ──
async function handleTransferAdmin(req: VercelRequest, res: VercelResponse) {
  if (req.method !== 'POST') return res.status(405).json({ error: 'Method not allowed' });

  let auth;
  try { auth = await requireAuth(req); } catch { return res.status(401).json({ error: 'Unauthorized' }); }
  if (!auth.familyId) return res.status(403).json({ error: 'You are not in a family group' });

  const { db } = await connectToDatabase();
  const family = await db.collection('families').findOne({ _id: new ObjectId(auth.familyId) });
  if (!family) return res.status(404).json({ error: 'Family not found' });

  const currentAdminEntry = family.members?.find(
    (m: { userId: string; role: string }) => m.userId === auth.userId && m.role === 'admin',
  );
  if (!currentAdminEntry) return res.status(403).json({ error: 'Only family admins can grant admin role' });

  const { newAdminUserId } = req.body ?? {};
  if (!newAdminUserId) return res.status(400).json({ error: 'newAdminUserId is required' });
  if (newAdminUserId === auth.userId) return res.status(400).json({ error: 'You are already an admin' });

  const targetMember = family.members?.find((m: { userId: string }) => m.userId === newAdminUserId);
  if (!targetMember) return res.status(404).json({ error: 'Target user is not a member of this family' });
  if (targetMember.role === 'admin') return res.status(400).json({ error: 'This member is already an admin' });

  // Promote target — caller keeps their own admin role (multiple admins allowed)
  await db.collection('families').updateOne(
    { _id: family._id, 'members.userId': newAdminUserId },
    { $set: { 'members.$.role': 'admin' } },
  );
  await db.collection('users').updateOne(
    { _id: new ObjectId(newAdminUserId) },
    { $set: { familyRole: 'admin' } },
  );

  return res.status(200).json({
    message: `${targetMember.displayName} is now also a family admin.`,
  });
}

// ─── POST /api/family/invite-email ───────────────────────────────────────────
async function handleInviteEmail(req: VercelRequest, res: VercelResponse) {
  if (req.method !== 'POST') return res.status(405).json({ error: 'Method not allowed' });

  let auth;
  try { auth = await requireAuth(req); } catch { return res.status(401).json({ error: 'Unauthorized' }); }
  if (!auth.familyId) return res.status(403).json({ error: 'You are not in a family group' });

  const { db } = await connectToDatabase();
  const family = await db.collection('families').findOne({ _id: new ObjectId(auth.familyId) });
  if (!family) return res.status(404).json({ error: 'Family not found' });

  const adminEntry = family.members?.find(
    (m: { userId: string; role: string }) => m.userId === auth.userId && m.role === 'admin',
  );
  if (!adminEntry) return res.status(403).json({ error: 'Only family admins can send invites' });

  const { email } = req.body ?? {};
  if (!email || typeof email !== 'string') return res.status(400).json({ error: 'email is required' });

  const emailNorm = String(email).toLowerCase().trim();

  // A user can only be in one family — check if they already have one
  const inviteeDoc = await db.collection('users').findOne({ email: emailNorm });
  if (inviteeDoc?.familyId) {
    return res.status(400).json({ error: 'This person is already in a family group' });
  }

  try {
    await sendFamilyInviteEmail(emailNorm, auth.displayName, family.name, family.inviteCode);
  } catch {
    return res.status(500).json({ error: 'Failed to send invite email. Check SMTP settings.' });
  }

  return res.status(200).json({ message: `Invite sent to ${emailNorm}` });
}

// ─── Main dispatcher ──────────────────────────────────────────────────────────
export default async function handler(req: VercelRequest, res: VercelResponse) {
  setCorsHeaders(res);
  if (handleOptions(req, res)) return;

  const action = req.query.action as string | undefined;

  try {
    switch (action) {
      case undefined:
      case '':           return await handleIndex(req, res);
      case 'create':     return await handleCreate(req, res);
      case 'join':       return await handleJoin(req, res);
      case 'approve':    return await handleApprove(req, res);
      case 'set-label':      return await handleSetLabel(req, res);
      case 'transfer-admin': return await handleTransferAdmin(req, res);
      case 'invite-email':   return await handleInviteEmail(req, res);
      default:
        return res.status(404).json({ error: 'Unknown family action' });
    }
  } catch (err) {
    console.error(`Family handler error [${action}]:`, err);
    return res.status(500).json({ error: 'Internal server error' });
  }
}
