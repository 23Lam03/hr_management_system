#!/usr/bin/env node
// scripts/seed-loadtest-user.js
// Phase 16 — create a single load-test user with a known password
// so the operator can target /api/auth/login from the load test.
//
// IMPORTANT: this script only seeds the TEST database
// (TEST_MONGODB_URI). It REFUSES to run against any URI that does
// not match the standard test pattern.

import mongoose from 'mongoose';
import bcrypt from 'bcrypt';

const uri = process.env.TEST_MONGODB_URI || process.env.MONGODB_URI;
if (!uri || !uri.includes('test')) {
  // eslint-disable-next-line no-console
  console.error(
    '[seed-loadtest-user] refusing to seed a non-test database. ' +
      'Set TEST_MONGODB_URI=mongodb://...test...',
  );
  process.exit(2);
}

await mongoose.connect(uri, { serverSelectionTimeoutMS: 5000 });

const User = mongoose.connection.collection('users');
const email = 'loadtest@example.com';
const password = 'loadtest-pwd-12345';
const passwordHash = await bcrypt.hash(password, 10);
const now = new Date();

const result = await User.findOneAndUpdate(
  { email },
  {
    $set: {
      email,
      passwordHash,
      role: 'admin',
      status: 'active',
      fullName: 'Load Test',
      updatedAt: now,
    },
    $setOnInsert: { createdAt: now },
  },
  { upsert: true, returnDocument: 'after' },
);
// eslint-disable-next-line no-console
console.log(`[seed-loadtest-user] ready: ${result.email} (id=${result._id})`);
await mongoose.disconnect();
process.exit(0);
