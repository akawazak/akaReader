import assert from 'node:assert/strict';
import test from 'node:test';
import { createRequire } from 'node:module';

const require = createRequire(import.meta.url);
const { DiscordPresenceController, normalizePresenceMode } = require('../runtime/discord-presence.cjs');

const waitFor = async (predicate) => {
  for (let attempt = 0; attempt < 40; attempt += 1) {
    if (predicate()) return;
    await new Promise(resolve => setTimeout(resolve, 0));
  }
  throw new Error('Timed out waiting for condition');
};

class FakeClient {
  static instances = [];

  constructor(options) {
    this.options = options;
    this.isConnected = false;
    this.activities = [];
    this.clearCount = 0;
    this.destroyCount = 0;
    this.listeners = new Map();
    this.user = {
      setActivity: async activity => { this.activities.push(activity); },
      clearActivity: async () => { this.clearCount += 1; },
    };
    FakeClient.instances.push(this);
  }

  on(event, listener) { this.listeners.set(event, listener); }
  async login() { this.isConnected = true; }
  async destroy() { this.destroyCount += 1; this.isConnected = false; }
}

test('publishes only the generic reading state and the configured application id', async () => {
  FakeClient.instances = [];
  const controller = new DiscordPresenceController({
    RPC: { Client: FakeClient },
    clientId: 'test-app-id',
    now: () => 1_700_000_000_000,
    reconnectDelayMs: 1,
  });

  controller.setMode('reading');
  controller.setEnabled(true);
  await waitFor(() => controller.snapshot().status === 'connected');

  const client = FakeClient.instances[0];
  assert.equal(client.options.clientId, 'test-app-id');
  assert.deepEqual(client.activities[0], {
    details: 'Reading manga',
    state: 'akaReader',
    startTimestamp: new Date(1_700_000_000_000),
  });
  assert.equal(Object.hasOwn(client.activities[0], 'title'), false);
  assert.equal(Object.hasOwn(client.activities[0], 'chapter'), false);
  await controller.dispose();
});

test('disabling clears the activity and tears down the local Discord connection', async () => {
  FakeClient.instances = [];
  const controller = new DiscordPresenceController({ RPC: { Client: FakeClient }, reconnectDelayMs: 1 });
  controller.setEnabled(true);
  await waitFor(() => controller.snapshot().status === 'connected');
  const client = FakeClient.instances[0];

  controller.setEnabled(false);
  await waitFor(() => client.destroyCount === 1);

  assert.equal(controller.snapshot().status, 'disabled');
  assert.equal(client.clearCount, 1);
});

test('missing Discord desktop support is non-fatal and remains unavailable', () => {
  const controller = new DiscordPresenceController({ RPC: null });
  const state = controller.setEnabled(true);

  assert.deepEqual(state, { enabled: true, mode: 'browsing', status: 'unavailable' });
});

test('only reading and browsing are valid presence modes', () => {
  assert.equal(normalizePresenceMode('reading'), 'reading');
  assert.equal(normalizePresenceMode('chapter 12 of private title'), 'browsing');
});
