// Tests verifying that the existing app (health check) and database
// connection still work after the model layer is added in Phase 2.
// Goal: catch any regression where models accidentally break the boot
// path or health endpoint.

import { describe, it, before, after } from 'node:test';
import { strict as assert } from 'node:assert';

import { createApp } from '../src/app.js';
import { getConnectionState } from '../src/config/database.js';
import { setupTestDb, teardownTestDb } from './helpers/db.js';

describe('Regression — health check + boot', () => {
  before(async () => {
    await setupTestDb();
  });
  after(async () => {
    await teardownTestDb();
  });

  it('reports connected after setupTestDb', () => {
    assert.equal(getConnectionState(), 'connected');
  });

  it('GET /api/health returns 200 and connected=true', async () => {
    const app = createApp();
    const server = app.listen(0); // ephemeral port
    try {
      const port = server.address().port;
      const res = await fetch(`http://127.0.0.1:${port}/api/health`);
      assert.equal(res.status, 200);
      const body = await res.json();
      assert.equal(body.success, true);
      assert.equal(body.data.database.connected, true);
      assert.equal(body.data.database.status, 'connected');
    } finally {
      await new Promise((resolve) => server.close(resolve));
    }
  });

  it('GET /api/health returns 503 after disconnect', async () => {
    // We tear down the test connection to simulate a lost DB.
    // (teardownTestDb is run after all tests, so do it manually here.)
    const app = createApp();
    const server = app.listen(0);
    try {
      // Force-disconnect for this test only, then re-setup for the next.
      const { disconnectDatabase } = await import('../src/config/database.js');
      await disconnectDatabase();
      const port = server.address().port;
      const res = await fetch(`http://127.0.0.1:${port}/api/health`);
      assert.equal(res.status, 503);
      const body = await res.json();
      assert.equal(body.data.database.connected, false);
    } finally {
      await new Promise((resolve) => server.close(resolve));
      // Reconnect for the next test (and the teardown at the end).
      await setupTestDb();
    }
  });
});