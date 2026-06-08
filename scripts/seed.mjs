import { readFileSync } from 'fs';
import { resolve } from 'path';
import dns from 'dns';
import bcrypt from 'bcryptjs';
import { MongoClient, ObjectId } from 'mongodb';
import crypto from 'crypto';

dns.setServers(['8.8.8.8', '8.8.4.4', '1.1.1.1']);

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

loadEnv();

const uri = process.env.MONGODB_URI;
const seedPassword = process.env.SEED_PASSWORD;

if (!seedPassword || seedPassword.length < 12) {
  console.error('SEED_PASSWORD must be set in .env and be at least 12 characters.');
  process.exit(1);
}

// ─── Demo account ──────────────────────────────────────────────────────────────

const DEMO_EMAIL = 'chinshaoyang343@gmail.com';
const DEMO_DISPLAY_NAME = 'Chin & Felicia';
const DEMO_FAMILY_NAME = 'Chin & Felicia';

// ─── Data ──────────────────────────────────────────────────────────────────────

const housingData = {
  housingType: 'HDB BTO',
  projectName: 'Alexandra Vista',
  address: '111B Tanglin Rd #24-115 Singapore 242111',
  roomType: '4-Room',
  flatPrice: 742600,
  currentStage: 'Wait for 2nd appointment',
  nextMilestoneDate: '',
  milestoneDates: {
    'Applied for HFE': '2025-03-09',
    'Ballot application done': '',
    'Awaiting ballot results': '2025-09-09',
    'Wait for first appointment': '2026-01-26',
    'Wait for 2nd appointment': '',
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
  updatedAt: new Date().toISOString(),
};

const cpfData = {
  // keyed by userId placeholder — will be replaced with real userId after insert
  CHIN_USER_ID: { oa: 26835.76, sa: 10226.87, ma: 13038.67 },
  FELICIA_USER_ID: { oa: 30697.05, sa: 8690.64, ma: 11312.26 },
};

async function seed() {
  if (!uri) {
    console.error('MONGODB_URI is not set. Add it to .env first.');
    process.exit(1);
  }

  const client = await MongoClient.connect(uri);
  const db = client.db('nestworth');

  try {
    const passwordHash = await bcrypt.hash(seedPassword, 10);
    const now = new Date().toISOString();

    // ── Upsert demo user (Chin) ────────────────────────────────────────────────
    let chinUser = await db.collection('users').findOne({ email: DEMO_EMAIL });
    if (!chinUser) {
      const result = await db.collection('users').insertOne({
        email: DEMO_EMAIL,
        displayName: DEMO_DISPLAY_NAME,
        passwordHash,
        passwordChangedAt: now,
        emailVerified: true,
        familyId: null,
        familyRole: null,
        onboardingComplete: false,
        createdAt: now,
      });
      chinUser = await db.collection('users').findOne({ _id: result.insertedId });
      console.log(`Created demo user: ${DEMO_EMAIL}`);
    } else {
      await db.collection('users').updateOne(
        { email: DEMO_EMAIL },
        { $set: { passwordHash, passwordChangedAt: now, emailVerified: true, updatedAt: now } },
      );
      chinUser = await db.collection('users').findOne({ email: DEMO_EMAIL });
      console.log(`Updated demo user: ${DEMO_EMAIL}`);
    }

    const chinId = chinUser._id.toString();

    // ── Upsert demo family ─────────────────────────────────────────────────────
    let family = await db.collection('families').findOne({ name: DEMO_FAMILY_NAME });
    if (!family) {
      const inviteCode = crypto.randomBytes(4).toString('hex').toUpperCase();
      const famResult = await db.collection('families').insertOne({
        name: DEMO_FAMILY_NAME,
        inviteCode,
        members: [{
          userId: chinId,
          displayName: DEMO_DISPLAY_NAME,
          email: DEMO_EMAIL,
          role: 'admin',
          joinedAt: now,
        }],
        pendingRequests: [],
        createdAt: now,
      });
      family = await db.collection('families').findOne({ _id: famResult.insertedId });
      console.log(`Created demo family: ${DEMO_FAMILY_NAME} (code: ${family.inviteCode})`);
    } else {
      console.log(`Demo family exists: ${DEMO_FAMILY_NAME} (code: ${family.inviteCode})`);
    }

    const familyId = family._id.toString();

    // ── Link user to family ────────────────────────────────────────────────────
    await db.collection('users').updateOne(
      { _id: new ObjectId(chinId) },
      { $set: { familyId, familyRole: 'admin', onboardingComplete: true } },
    );

    // ── Housing project ────────────────────────────────────────────────────────
    await db.collection('housing').updateOne(
      { familyId },
      { $set: { ...housingData, familyId } },
      { upsert: true },
    );
    console.log('Seeded housing: Alexandra Vista (HDB BTO 4-Room, S$742,600)');

    // ── Monthly checkins ───────────────────────────────────────────────────────
    const cpfRecord = {
      [chinId]: { oa: 26835.76, sa: 10226.87, ma: 13038.67 },
    };

    const baseCheckin = {
      familyId,
      cpf: cpfRecord,
      ledger: {
        income: { [chinId]: 5500 },
        fixedExpenses: [
          { label: 'Rent / mortgage', amount: 0 },
          { label: 'Utilities', amount: 180 },
          { label: 'Insurance premiums', amount: 320 },
          { label: 'Transport', amount: 150 },
        ],
        discretionary: [
          { category: 'Dining out', budget: 300, spent: 245, owner: chinId },
          { category: 'Groceries', budget: 400, spent: 380, owner: chinId },
        ],
        notes: 'Sample month — replace with actuals.',
      },
      investments: [
        { id: 'inv1', name: 'US equities', type: 'equity', value: 25000, platform: 'IBKR', owner: chinId },
        { id: 'inv2', name: 'SG REITs ETF', type: 'etf', value: 12000, platform: 'DBS Vickers', owner: chinId },
      ],
      insurance: [
        { id: 'ins1', name: 'Integrated Shield Plan', type: 'shield', premium: 85, renewalDate: '2026-11-01', coverage: 'Hospitalisation', owner: chinId },
        { id: 'ins2', name: 'Term life', type: 'life', premium: 120, renewalDate: '2027-01-15', coverage: '$500k death', owner: chinId },
      ],
      notes: 'Sample data — update with accurate figures.',
      updatedAt: now,
      updatedBy: 'Seed',
    };

    for (const month of ['2026-05', '2026-06']) {
      await db.collection('monthly_checkins').updateOne(
        { familyId, monthYear: month },
        { $set: { ...baseCheckin, monthYear: month } },
        { upsert: true },
      );
      console.log(`Seeded check-in: ${month}`);
    }

    console.log('\nLogin credentials:');
    console.log(`  Email:    ${DEMO_EMAIL}`);
    console.log(`  Password: ${seedPassword}`);
    console.log(`  Family:   ${DEMO_FAMILY_NAME} (invite: ${family.inviteCode})`);
    console.log('\nEmail OTP is sent on every login.');
    console.log('Password expires every 90 days — a reset code is emailed automatically.');
  } finally {
    await client.close();
  }
}

seed().catch((err) => {
  console.error('Seed failed:', err.message);
  process.exit(1);
});
