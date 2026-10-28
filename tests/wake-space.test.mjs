import assert from 'node:assert/strict';
import test from 'node:test';
import { wakeSpace } from '../scripts/wake-space.mjs';

function response(body, status = 200) {
  return {
    ok: status >= 200 && status < 300,
    status,
    async text() {
      return JSON.stringify(body);
    }
  };
}

function mockFetch(responses) {
  const requests = [];
  const fetchImpl = async (url, options = {}) => {
    requests.push({ url, options });
    const next = responses.shift();
    if (!next) throw new Error('Unexpected request');
    return response(next.body, next.status);
  };
  return { fetchImpl, requests };
}

test('skips a running Space without calling restart', async () => {
  const { fetchImpl, requests } = mockFetch([
    { body: { stage: 'RUNNING', hardware: { current: 'cpu-basic' } } }
  ]);

  const result = await wakeSpace({ spaceId: 'Elykia/ek', token: 'test-token', fetchImpl, logger: () => {} });

  assert.deepEqual(result, { action: 'skipped', spaceId: 'Elykia/ek', stage: 'RUNNING' });
  assert.equal(requests.length, 1);
  assert.equal(requests[0].options.method, undefined);
  assert.match(requests[0].url, /\/api\/spaces\/Elykia\/ek\/runtime$/);
});

test('restarts a sleeping Space', async () => {
  const { fetchImpl, requests } = mockFetch([
    { body: { stage: 'SLEEPING' } },
    { body: { stage: 'APP_STARTING' } }
  ]);

  const result = await wakeSpace({ spaceId: 'Elykia/ek', token: 'test-token', fetchImpl, logger: () => {} });

  assert.deepEqual(result, {
    action: 'restarted',
    spaceId: 'Elykia/ek',
    stage: 'SLEEPING',
    stageAfterRequest: 'APP_STARTING'
  });
  assert.equal(requests.length, 2);
  assert.equal(requests[1].options.method, 'POST');
  assert.match(requests[1].url, /\/api\/spaces\/Elykia\/ek\/restart$/);
});

test('restarts the current STOPPED idle state', async () => {
  const { fetchImpl, requests } = mockFetch([
    { body: { stage: 'STOPPED' } },
    { body: { stage: 'BUILDING' } }
  ]);

  const result = await wakeSpace({ spaceId: 'Elykia/ek', token: 'test-token', fetchImpl, logger: () => {} });

  assert.equal(result.action, 'restarted');
  assert.equal(requests[1].options.method, 'POST');
});

test('does not restart a manually paused Space', async () => {
  const { fetchImpl, requests } = mockFetch([{ body: { stage: 'PAUSED' } }]);

  const result = await wakeSpace({ spaceId: 'Elykia/ek', token: 'test-token', fetchImpl, logger: () => {} });

  assert.equal(result.action, 'skipped');
  assert.equal(requests.length, 1);
});

test('fails clearly when the runtime API rejects the request', async () => {
  const { fetchImpl } = mockFetch([{ status: 401, body: { error: 'Invalid username or password.' } }]);

  await assert.rejects(
    wakeSpace({ spaceId: 'Elykia/ek', token: 'test-token', fetchImpl, logger: () => {} }),
    /HTTP 401: Invalid username or password/
  );
});
