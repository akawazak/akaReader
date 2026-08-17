const fs = require('node:fs');
const path = require('node:path');

const REQUIRED_BACKEND_FILES = Object.freeze([
  'server.js',
  'source-errors.js',
  'package.json',
  'node_modules/express/package.json',
  'node_modules/cors/package.json',
  'node_modules/axios/package.json',
]);

function getMissingBackendFiles(backendRoot, existsSync = fs.existsSync) {
  return REQUIRED_BACKEND_FILES.filter(relativePath => (
    !existsSync(path.join(backendRoot, ...relativePath.split('/')))
  ));
}

module.exports = {
  REQUIRED_BACKEND_FILES,
  getMissingBackendFiles,
};
