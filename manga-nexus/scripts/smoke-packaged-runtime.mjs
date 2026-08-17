import fs from 'node:fs';
import net from 'node:net';
import path from 'node:path';
import process from 'node:process';
import { spawn, spawnSync } from 'node:child_process';

const packageRoot = path.resolve(process.argv[2] || (
  process.platform === 'win32' ? 'dist-electron/win-unpacked' : 'dist-electron/linux-unpacked'
));
const executableName = process.platform === 'win32' ? 'akaReader.exe' : 'akareader';
const executable = path.join(packageRoot, executableName);
const timeoutMs = 60000;

function canConnect(port) {
  return new Promise(resolve => {
    const socket = net.createConnection({ host: '127.0.0.1', port });
    const finish = value => {
      socket.removeAllListeners();
      socket.destroy();
      resolve(value);
    };
    socket.once('connect', () => finish(true));
    socket.once('error', () => finish(false));
    socket.setTimeout(1000, () => finish(false));
  });
}

async function waitForPort(port, child) {
  const startedAt = Date.now();
  while (Date.now() - startedAt < timeoutMs) {
    if (await canConnect(port)) return Date.now() - startedAt;
    if (child.exitCode !== null) {
      throw new Error(`Packaged akaReader exited before port ${port} opened (exit ${child.exitCode}).`);
    }
    await new Promise(resolve => setTimeout(resolve, 500));
  }
  throw new Error(`Packaged akaReader did not open port ${port} within ${timeoutMs / 1000} seconds.`);
}

if (await canConnect(3001)) {
  throw new Error('Port 3001 is already in use; refusing a false-positive smoke test.');
}

if (!fs.existsSync(executable)) {
  const packagedFiles = fs.existsSync(packageRoot)
    ? fs.readdirSync(packageRoot).sort().join(', ')
    : '(package directory does not exist)';
  throw new Error(`Packaged executable ${executableName} was not found in ${packageRoot}. Found: ${packagedFiles}`);
}

const child = spawn(executable, ['--disable-gpu'], {
  detached: process.platform !== 'win32',
  stdio: 'ignore',
});

try {
  const elapsedMs = await waitForPort(3001, child);
  console.log(`Packaged runtime smoke test passed: port 3001 ready in ${(elapsedMs / 1000).toFixed(1)}s.`);
} finally {
  if (process.platform === 'win32') {
    spawnSync('taskkill', ['/pid', String(child.pid), '/t', '/f'], { stdio: 'ignore' });
  } else {
    try { process.kill(-child.pid, 'SIGTERM'); } catch {}
  }
}
