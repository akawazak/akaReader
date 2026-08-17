const test = require('node:test');
const assert = require('node:assert/strict');
const http = require('node:http');
const path = require('node:path');
const { spawn } = require('node:child_process');

const API_TOKEN = 'test-only-api-token';
const ALLOWED_ORIGIN = 'http://localhost:5173';

const listen = server => new Promise((resolve, reject) => {
  server.once('error', reject);
  server.listen(0, '127.0.0.1', () => resolve(server.address().port));
});

const close = server => new Promise(resolve => server.close(resolve));

const waitForBackend = async baseUrl => {
  let lastError;
  for (let attempt = 0; attempt < 150; attempt++) {
    try {
      const response = await fetch(`${baseUrl}/api/ping`, {
        headers: { 'X-AkaReader-Token': API_TOKEN, Origin: ALLOWED_ORIGIN },
      });
      if (response.ok) return;
      lastError = new Error(`Backend returned ${response.status}`);
    } catch (error) {
      lastError = error;
    }
    await new Promise(resolve => setTimeout(resolve, 100));
  }
  throw lastError || new Error('Backend did not start');
};

test('local API and image proxy enforce their security boundary', async t => {
  const imageBytes = Buffer.from([0x89, 0x50, 0x4e, 0x47]);
  let backendBaseUrl = '';
  let markSlowCoverStarted;
  let markSlowCoverCancelled;
  const slowCoverStarted = new Promise(resolve => { markSlowCoverStarted = resolve; });
  const slowCoverCancelled = new Promise(resolve => { markSlowCoverCancelled = resolve; });
  const suwayomi = http.createServer((req, res) => {
    if (req.url === '/cover') {
      res.writeHead(200, { 'Content-Type': 'image/png' });
      res.end(imageBytes);
      return;
    }
    if (req.url === '/slow-cover') {
      markSlowCoverStarted();
      const timer = setTimeout(() => {
        res.writeHead(200, { 'Content-Type': 'image/png' });
        res.end(imageBytes);
      }, 10000);
      res.on('close', () => {
        clearTimeout(timer);
        if (!res.writableEnded) markSlowCoverCancelled();
      });
      return;
    }
    if (req.url === '/redirect-to-backend') {
      res.writeHead(302, { Location: `${backendBaseUrl}/api/ping` });
      res.end();
      return;
    }
    res.writeHead(404);
    res.end();
  });
  const suwayomiPort = await listen(suwayomi);
  t.after(() => close(suwayomi));

  const portProbe = http.createServer();
  const backendPort = await listen(portProbe);
  await close(portProbe);
  backendBaseUrl = `http://127.0.0.1:${backendPort}`;

  const child = spawn(process.execPath, ['server.js'], {
    cwd: path.resolve(__dirname, '..'),
    env: {
      ...process.env,
      HOST: '127.0.0.1',
      PORT: String(backendPort),
      AKAREADER_API_TOKEN: API_TOKEN,
      SUWAYOMI_URL: `http://127.0.0.1:${suwayomiPort}`,
    },
    stdio: ['ignore', 'pipe', 'pipe'],
    windowsHide: true,
  });
  let childOutput = '';
  child.stdout.on('data', chunk => { childOutput += chunk; });
  child.stderr.on('data', chunk => { childOutput += chunk; });
  t.after(() => {
    if (!child.killed) child.kill();
  });

  await waitForBackend(backendBaseUrl).catch(error => {
    throw new Error(`${error.message}\nchild exit=${child.exitCode} signal=${child.signalCode}\n${childOutput}`);
  });

  await t.test('rejects requests without the per-launch API token', async () => {
    const response = await fetch(`${backendBaseUrl}/api/ping`, {
      headers: { Origin: ALLOWED_ORIGIN },
    });
    assert.equal(response.status, 401);
  });

  await t.test('rejects requests from an unapproved web origin', async () => {
    const response = await fetch(`${backendBaseUrl}/api/ping`, {
      headers: { 'X-AkaReader-Token': API_TOKEN, Origin: 'https://attacker.example' },
    });
    assert.equal(response.status, 403);
  });

  await t.test('preserves an authenticated request from the renderer', async () => {
    const response = await fetch(`${backendBaseUrl}/api/ping`, {
      headers: { 'X-AkaReader-Token': API_TOKEN, Origin: ALLOWED_ORIGIN },
    });
    assert.equal(response.status, 200);
    assert.equal((await response.json()).ok, true);
  });

  await t.test('blocks direct requests to a different loopback service', async () => {
    const target = encodeURIComponent(`${backendBaseUrl}/api/ping`);
    const response = await fetch(`${backendBaseUrl}/api/img?url=${target}&api_token=${API_TOKEN}`, {
      headers: { Origin: ALLOWED_ORIGIN },
    });
    assert.equal(response.status, 403);
  });

  await t.test('blocks redirects away from the configured Suwayomi origin', async () => {
    const target = encodeURIComponent(`http://127.0.0.1:${suwayomiPort}/redirect-to-backend`);
    const response = await fetch(`${backendBaseUrl}/api/img?url=${target}&api_token=${API_TOKEN}`, {
      headers: { Origin: ALLOWED_ORIGIN },
    });
    assert.equal(response.status, 403);
  });

  await t.test('preserves images served by the configured Suwayomi origin', async () => {
    const target = encodeURIComponent(`http://127.0.0.1:${suwayomiPort}/cover`);
    const response = await fetch(`${backendBaseUrl}/api/img?url=${target}&api_token=${API_TOKEN}`, {
      headers: { Origin: ALLOWED_ORIGIN },
    });
    assert.equal(response.status, 200);
    assert.equal(response.headers.get('content-type'), 'image/png');
    assert.deepEqual(Buffer.from(await response.arrayBuffer()), imageBytes);
  });

  await t.test('reader pages cancel abandoned cover work instead of waiting behind it', async () => {
    const slowTarget = encodeURIComponent(`http://127.0.0.1:${suwayomiPort}/slow-cover`);
    const slowRequest = http.get(`${backendBaseUrl}/api/img?url=${slowTarget}&api_token=${API_TOKEN}`, {
      headers: { Origin: ALLOWED_ORIGIN },
    });
    slowRequest.on('response', response => response.resume());
    slowRequest.on('error', () => {});
    await slowCoverStarted;

    const pageTarget = encodeURIComponent(`http://127.0.0.1:${suwayomiPort}/cover`);
    const pageResponse = await fetch(`${backendBaseUrl}/api/img?url=${pageTarget}&kind=page&api_token=${API_TOKEN}`, {
      headers: { Origin: ALLOWED_ORIGIN },
    });
    assert.equal(pageResponse.status, 200);
    assert.deepEqual(Buffer.from(await pageResponse.arrayBuffer()), imageBytes);

    await Promise.race([
      slowCoverCancelled,
      new Promise((_, reject) => setTimeout(() => reject(new Error('Slow cover request was not cancelled')), 2000)),
    ]);
    slowRequest.destroy();
  });
});
