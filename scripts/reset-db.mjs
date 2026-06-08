/**
 * Full database reset for Nestworth.
 *
 * Usage:
 *   node scripts/reset-db.mjs
 *
 * What it does:
 *   1. Drops ALL data from every collection used by the app
 *   2. Re-creates the collections with correct indexes
 *   3. Seeds ONE fresh demo account (Chin) linked to a demo family
 *      with real CPF / housing / checkin data
 *
 * Requires MONGODB_URI and SEED_PASSWORD to be set in .env
 */

import { readFileSync } from 'fs';
import { resolve } from 'path';
import dns from 'dns';
import bcrypt from 'bcryptjs';
import { MongoClient, ObjectId } from 'mongodb';
import crypto from 'crypto';
import readline from 'readline';

dns.setServers(['8.8.8.8', '8.8.4.4', '1.1.1.1']);

// ─── .env loader ─────────────────────────────────────────────────────────────

function loadEnv() {
  try {
    const envPath = resolve(process.cwd(), '.env');
    const content = readFileSync(envPath, 'utf8');
    for (const line of content.split('\n')) {
      const trimmed = line.trim();
      if (!trimmed || trimmed.startsWith('#')) continue;
      const eq = trimmed.indexOf('=');
      if (eq === -1) continue;
      const key = trimmed.slice(0, eq);
      const value = trimmed.slice(eq + 1);
      if (!process.env[key]) process.env[key] = value;
    }
  } catch { /* rely on existing env vars */ }
}

async function confirm(question) {
  const rl = readline.createInterface({ input: process.stdin, output: process.stdout });
  return new Promise((resolve) => {
    rl.question(question, (answer) => {
      rl.close();
      resolve(answer.trim().toLowerCase());
    });
  });
}

loadEnv();

const uri = process.env.MONGODB_URI;
const seedPassword = process.env.SEED_PASSWORD;

if (!uri) { console.error('MONGODB_URI is not set in .env'); process.exit(1); }
if (!seedPassword || seedPassword.length < 12) {
  console.error('SEED_PASSWORD must be set in .env and be at least 12 characters.');
  process.exit(1);
}

// ─── Demo data ────────────────────────────────────────────────────────────────

const DEMO = {
  email: 'chinshaoyang343@gmail.com',
  displayName: 'Shaoyang',
  familyName: 'Chin & Felicia',
};

const HOUSING = {
  housingType: 'HDB BTO',
  projectName: 'Alexandra Vista',
  address: '111B Tanglin Rd #24-115 Singapore 242111',
  roomType: '4-Room',
  flatPrice: 742600,
  currentStage: 'Wait for 2nd appointment',
  nextMilestoneDate: '',
  milestoneDates: {
    'Applied for HFE':            '2025-03-09',
    'Ballot application done':    '',
    'Awaiting ballot results':    '2025-09-09',
    'Wait for first appointment': '2026-01-26',
    'Wait for 2nd appointment':   '',
  },
  milestoneExtras: {
    'Wait for first appointment': {
      appointmentDatetime: '26 Jan 2026, 08:30 AM',
      appointmentNote: '',
    },
  },
  bookingFee: 0,
  downpayment: 0,
  subsidyClawbackRate: 0.11,
  notes: '',
};

// ─── Collections the app uses ─────────────────────────────────────────────────

const COLLECTIONS = [
  'users',
  'families',
  'monthly_checkins',
  'housing',
  'email_otps',
  'rate_limits',
  'notifications',
];

// ─── Main ─────────────────────────────────────────────────────────────────────

const client = new MongoClient(uri);

async function run() {
  await client.connect();
  const db = client.db('nestworth');

  // List what currently exists
  const existing = await db.listCollections().toArray();
  const existingNames = existing.map(c => c.name);
  console.log('\nExisting collections:', existingNames.length ? existingNames.join(', ') : '(none)');

  // Count documents across collections
  for (const name of existingNames.filter(n => COLLECTIONS.includes(n))) {
    const count = await db.collection(name).countDocuments();
    console.log(`  ${name}: ${count} document${count !== 1 ? 's' : ''}`);
  }

  console.log('\n⚠️  This will DELETE ALL DATA in the nestworth database and re-seed from scratch.');
  const answer = await confirm('Type "reset" to confirm: ');
  if (answer !== 'reset') {
    console.log('Aborted.');
    await client.close();
    return;
  }

  // ── Step 1: Drop all app collections ────────────────────────────────────────
  console.log('\nDropping collections…');
  for (const name of COLLECTIONS) {
    try {
      await db.collection(name).drop();
      console.log(`  dropped: ${name}`);
    } catch {
      // Collection may not exist — that's fine
      console.log(`  skipped (not found): ${name}`);
    }
  }

  // ── Step 2: Recreate with indexes ────────────────────────────────────────────
  console.log('\nCreating indexes…');

  await db.collection('users').createIndex({ email: 1 }, { unique: true });
  await db.collection('families').createIndex({ inviteCode: 1 }, { unique: true });
  await db.collection('monthly_checkins').createIndex({ familyId: 1, monthYear: 1 }, { unique: true });
  await db.collection('housing').createIndex({ familyId: 1 }, { unique: true });
  await db.collection('email_otps').createIndex({ userId: 1, purpose: 1 });
  await db.collection('email_otps').createIndex({ expiresAt: 1 }, { expireAfterSeconds: 0 });
  await db.collection('rate_limits').createIndex({ key: 1 }, { unique: true });
  await db.collection('notifications').createIndex({ familyId: 1, createdAt: -1 });

  console.log('  indexes created.');

  // ── Step 3: Seed demo user ────────────────────────────────────────────────────
  console.log('\nSeeding demo data…');
  const now = new Date().toISOString();
  const passwordHash = await bcrypt.hash(seedPassword, 10);
  const inviteCode = crypto.randomBytes(4).toString('hex').toUpperCase();

  const userResult = await db.collection('users').insertOne({
    email: DEMO.email,
    displayName: DEMO.displayName,
    passwordHash,
    passwordChangedAt: now,
    emailVerified: true,
    familyId: null,
    familyRole: null,
    onboardingComplete: false,
    notificationPrefs: { cpf: true, investment: true, expense: true },
    createdAt: now,
  });
  const userId = userResult.insertedId.toString();
  console.log(`  user created: ${DEMO.email} (${userId})`);

  // ── Step 4: Seed demo family ──────────────────────────────────────────────────
  const familyResult = await db.collection('families').insertOne({
    name: DEMO.familyName,
    inviteCode,
    members: [{
      userId,
      displayName: DEMO.displayName,
      email: DEMO.email,
      role: 'admin',
      joinedAt: now,
    }],
    pendingRequests: [],
    memberLabels: {},
    expoPushTokens: {},
    createdAt: now,
  });
  const familyId = familyResult.insertedId.toString();
  console.log(`  family created: "${DEMO.familyName}" (invite code: ${inviteCode})`);

  // Link user → family
  await db.collection('users').updateOne(
    { _id: userResult.insertedId },
    { $set: { familyId, familyRole: 'admin', onboardingComplete: true } },
  );

  // ── Step 5: Seed housing ──────────────────────────────────────────────────────
  await db.collection('housing').insertOne({
    ...HOUSING,
    familyId,
    updatedAt: now,
  });
  console.log(`  housing created: ${HOUSING.projectName} (${HOUSING.roomType}, S$${HOUSING.flatPrice.toLocaleString()})`);

  // ── Step 6: Seed monthly check-ins ───────────────────────────────────────────
  const baseCheckin = {
    familyId,
    cpf: {
      [userId]: { oa: 26835.76, sa: 10226.87, ma: 13038.67 },
    },
    ledger: {
      income: { [userId]: 5500 },
      fixedExpenses: [
        { label: 'Rent / mortgage', amount: 0 },
        { label: 'Utilities', amount: 180 },
        { label: 'Insurance premiums', amount: 320 },
        { label: 'Transport', amount: 150 },
      ],
      discretionary: [
        { category: 'Dining out', budget: 300, spent: 245, owner: userId },
        { category: 'Groceries', budget: 400, spent: 380, owner: userId },
      ],
      notes: '',
    },
    investments: [
      {
        id: 'inv1',
        name: 'SPDR S&P 500 ETF',
        type: 'ETF',
        ticker: 'SPY',
        qty: 10,
        entryPrice: 480.00,
        entryDate: '2024-06-01',
        currentPrice: 0,
        currentPriceUpdatedAt: '',
        value: 4800,
        platform: 'IBKR',
        owner: userId,
      },
      {
        id: 'inv2',
        name: 'Nikko AM STI ETF',
        type: 'ETF',
        ticker: 'ES3.SI',
        qty: 500,
        entryPrice: 3.20,
        entryDate: '2024-03-15',
        currentPrice: 0,
        currentPriceUpdatedAt: '',
        value: 1600,
        platform: 'DBS Vickers',
        owner: userId,
      },
    ],
    insurance: [
      {
        id: 'ins1',
        name: 'Integrated Shield Plan',
        type: 'shield',
        premium: 85,
        renewalDate: '2026-11-01',
        coverage: 'Hospitalisation',
        owner: userId,
      },
      {
        id: 'ins2',
        name: 'Term Life',
        type: 'life',
        premium: 120,
        renewalDate: '2027-01-15',
        coverage: 'S$500,000 death benefit',
        owner: userId,
      },
    ],
    notes: '',
    updatedAt: now,
    updatedBy: 'Seed',
  };

  for (const month of ['2026-05', '2026-06']) {
    await db.collection('monthly_checkins').insertOne({ ...baseCheckin, monthYear: month });
    console.log(`  check-in seeded: ${month}`);
  }

  // ── Summary ───────────────────────────────────────────────────────────────────
  console.log('\n✓ Reset complete.\n');
  console.log('Login credentials:');
  console.log(`  Email:         ${DEMO.email}`);
  console.log(`  Password:      ${seedPassword}`);
  console.log(`  Family:        ${DEMO.familyName}`);
  console.log(`  Invite code:   ${inviteCode}`);
  console.log('\nAn email OTP is required on every login.');

  await client.close();
}

run().catch((err) => {
  console.error('\nReset failed:', err.message);
  client.close();
  process.exit(1);
});
