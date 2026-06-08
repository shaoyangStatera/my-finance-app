/**
 * Delete a user account and all associated data by email.
 *
 * Usage:
 *   node scripts/delete-user.mjs someone@example.com
 *
 * What it removes:
 *   - The user document from `users`
 *   - Their OTP records from `email_otps`
 *   - Their rate-limit records from `rate_limits`
 *   - If they are the ONLY member of a family:
 *       - The family document from `families`
 *       - All monthly check-ins for that family from `monthly_checkins`
 *       - The housing record for that family from `housing`
 *       - All notifications for that family from `notifications`
 *   - If they are ONE OF SEVERAL members of a family:
 *       - Removes them from `families.members`
 *       - Removes their CPF data from all monthly check-ins (cpf[userId])
 *       - Removes their income from all monthly check-ins (ledger.income[userId])
 *       - Removes their investment items from all monthly check-ins
 *       - Removes their insurance items from all monthly check-ins
 *       - Removes their discretionary items from all monthly check-ins
 */

import { readFileSync } from 'fs';
import { resolve } from 'path';
import dns from 'dns';
import { MongoClient, ObjectId } from 'mongodb';
import readline from 'readline';

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

const email = process.argv[2]?.toLowerCase().trim();
if (!email) {
  console.error('Usage: node scripts/delete-user.mjs <email>');
  process.exit(1);
}

const uri = process.env.MONGODB_URI;
if (!uri) {
  console.error('MONGODB_URI is not set in .env');
  process.exit(1);
}

const client = new MongoClient(uri);

async function run() {
  await client.connect();
  const db = client.db('nestworth');

  // ── 1. Find the user ──────────────────────────────────────────────────────
  const user = await db.collection('users').findOne({ email });
  if (!user) {
    console.log(`No user found with email: ${email}`);
    await client.close();
    return;
  }

  const userId = user._id.toString();
  console.log(`\nFound user:`);
  console.log(`  ID:          ${userId}`);
  console.log(`  Name:        ${user.displayName}`);
  console.log(`  Email:       ${user.email}`);
  console.log(`  Family ID:   ${user.familyId ?? '(none)'}`);
  console.log(`  Family role: ${user.familyRole ?? '(none)'}`);

  // ── 2. Inspect family membership ─────────────────────────────────────────
  let family = null;
  let isLastMember = false;

  if (user.familyId) {
    family = await db.collection('families').findOne({ _id: new ObjectId(user.familyId) });
    if (family) {
      const memberCount = family.members?.length ?? 0;
      isLastMember = memberCount <= 1;
      console.log(`\nFamily: "${family.name}" (${memberCount} member${memberCount !== 1 ? 's' : ''})`);
      if (isLastMember) {
        console.log('  → Only member. Family and all its data will be deleted.');
      } else {
        console.log('  → User will be removed from the family. Other members and family data will be kept.');
      }
    }
  }

  // ── 3. Confirm ────────────────────────────────────────────────────────────
  console.log('\n⚠️  This action is IRREVERSIBLE.');
  const answer = await confirm(`Type "yes" to confirm deletion of ${email}: `);
  if (answer !== 'yes') {
    console.log('Aborted.');
    await client.close();
    return;
  }

  // ── 4. Delete / clean up ──────────────────────────────────────────────────
  const results = {};

  // Always: remove user doc
  const delUser = await db.collection('users').deleteOne({ _id: user._id });
  results['users deleted'] = delUser.deletedCount;

  // Always: remove OTPs
  const delOtps = await db.collection('email_otps').deleteMany({ userId });
  results['email_otps deleted'] = delOtps.deletedCount;

  // Always: remove rate limit records keyed by IP can't be user-scoped,
  // but remove any keyed by userId if present
  const delRl = await db.collection('rate_limits').deleteMany({ userId });
  results['rate_limits deleted'] = delRl.deletedCount;

  if (family && isLastMember) {
    // Remove entire family and all family-scoped data
    const delFamily = await db.collection('families').deleteOne({ _id: family._id });
    results['families deleted'] = delFamily.deletedCount;

    const delCheckins = await db.collection('monthly_checkins').deleteMany({ familyId: user.familyId });
    results['monthly_checkins deleted'] = delCheckins.deletedCount;

    const delHousing = await db.collection('housing').deleteMany({ familyId: user.familyId });
    results['housing deleted'] = delHousing.deletedCount;

    const delNotifs = await db.collection('notifications').deleteMany({ familyId: user.familyId });
    results['notifications deleted'] = delNotifs.deletedCount;

  } else if (family && !isLastMember) {
    // Remove user from family members list and pending requests
    await db.collection('families').updateOne(
      { _id: family._id },
      {
        $pull: {
          members: { userId },
          pendingRequests: { userId },
        },
        $unset: {
          [`expoPushTokens.${userId}`]: '',
          [`memberLabels.${userId}`]: '',
        },
      },
    );
    results['removed from family'] = 1;

    // If they were admin, log a warning
    const wasAdmin = family.members?.some(m => m.userId === userId && m.role === 'admin');
    if (wasAdmin) {
      console.log('\n⚠️  Heads up: this user was the family admin. No new admin was auto-assigned.');
      console.log('   The remaining members should use Settings > Transfer admin to reassign.');
    }

    // Remove user's data from all check-ins in the family
    const checkins = await db.collection('monthly_checkins')
      .find({ familyId: user.familyId })
      .toArray();

    let checkinsUpdated = 0;
    for (const checkin of checkins) {
      const update = {
        $unset: {
          [`cpf.${userId}`]: '',
          [`ledger.income.${userId}`]: '',
        },
        $pull: {
          investments: { owner: userId },
          insurance: { owner: userId },
        },
      };

      // Remove discretionary items owned by user
      const filteredDiscretionary = (checkin.ledger?.discretionary ?? [])
        .filter(item => item.owner !== userId);

      const res = await db.collection('monthly_checkins').updateOne(
        { _id: checkin._id },
        {
          ...update,
          $set: { 'ledger.discretionary': filteredDiscretionary },
        },
      );
      if (res.modifiedCount > 0) checkinsUpdated++;
    }
    results['monthly_checkins updated'] = checkinsUpdated;

    // Remove from notifications readBy arrays
    await db.collection('notifications').updateMany(
      { familyId: user.familyId },
      { $pull: { readBy: userId } },
    );
    results['notifications cleaned'] = 1;
  }

  // ── 5. Summary ────────────────────────────────────────────────────────────
  console.log('\nDone. Summary:');
  for (const [key, val] of Object.entries(results)) {
    console.log(`  ${key}: ${val}`);
  }

  await client.close();
}

run().catch((err) => {
  console.error('Script failed:', err);
  client.close();
  process.exit(1);
});
