import fs from 'node:fs';
import path from 'node:path';
import { createRequire } from 'node:module';

const require = createRequire(import.meta.url);
const { getMissingBackendFiles } = require('../runtime/backend-runtime.cjs');

const packageRoot = path.resolve(process.argv[2] || 'dist-electron/win-unpacked');
const backendRoot = path.join(packageRoot, 'resources', 'backend');
const requiredFiles = [
  'resources/app.asar',
];

const missing = [
  ...requiredFiles.filter(relativePath => (
  !fs.existsSync(path.join(packageRoot, relativePath))
  )),
  ...getMissingBackendFiles(backendRoot).map(relativePath => `resources/backend/${relativePath}`),
];

if (missing.length) {
  console.error(`Packaged runtime is incomplete at ${packageRoot}:`);
  for (const relativePath of missing) console.error(`- ${relativePath}`);
  process.exit(1);
}

console.log(`Packaged runtime verified: ${packageRoot}`);
