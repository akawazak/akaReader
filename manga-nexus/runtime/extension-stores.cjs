const DEFAULT_EXTENSION_STORES = Object.freeze([
  'https://raw.githubusercontent.com/keiyoushi/extensions/repo/index.min.json',
]);

function isValidExtensionStoreUrl(value) {
  if (typeof value !== 'string' || value.length > 2048) return false;
  try {
    const url = new URL(value.trim());
    return ['http:', 'https:'].includes(url.protocol) && !!url.hostname;
  } catch {
    return false;
  }
}

function normalizeExtensionStoreUrls(values) {
  if (!Array.isArray(values)) return [];
  const seen = new Set(DEFAULT_EXTENSION_STORES);
  const normalized = [];
  for (const value of values) {
    const url = typeof value === 'string' ? value.trim() : '';
    if (!isValidExtensionStoreUrl(url) || seen.has(url)) continue;
    seen.add(url);
    normalized.push(url);
  }
  return normalized;
}

function configuredExtensionStores(customStores = []) {
  return [...DEFAULT_EXTENSION_STORES, ...normalizeExtensionStoreUrls(customStores)];
}

function upsertSetting(config, key, value) {
  const escapedKey = key.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
  const linePattern = new RegExp(`^\\s*${escapedKey}\\s*=`);
  const lines = String(config || '').split(/\r?\n/);
  const output = [];
  let replaced = false;

  for (let index = 0; index < lines.length; index += 1) {
    const line = lines[index];
    if (!linePattern.test(line)) {
      output.push(line);
      continue;
    }

    if (!replaced) {
      output.push(`${key} = ${value}`);
      replaced = true;
    }

    const rhs = line.slice(line.indexOf('=') + 1);
    let bracketDepth = (rhs.match(/\[/g) || []).length - (rhs.match(/\]/g) || []).length;
    while (bracketDepth > 0 && index + 1 < lines.length) {
      index += 1;
      bracketDepth += (lines[index].match(/\[/g) || []).length - (lines[index].match(/\]/g) || []).length;
    }

    // Repair the malformed tail created by the old line-only migration:
    // `extensionStores = [...]` followed by leftover quoted entries and `]`.
    if (bracketDepth <= 0) {
      let tailIndex = index + 1;
      let foundEntry = false;
      while (tailIndex < lines.length && /^\s*"https?:\/\/[^"\r\n]+"\s*,?\s*$/.test(lines[tailIndex])) {
        foundEntry = true;
        tailIndex += 1;
      }
      if (foundEntry && /^\s*\]\s*$/.test(lines[tailIndex] || '')) index = tailIndex;
    }
  }

  if (!replaced) output.push(`${key} = ${value}`);
  return `${output.join('\n').trimEnd()}\n`;
}

function buildSuwayomiConfig(existing = '', customStores = []) {
  const managedBlock = /# akaReader managed settings[\s\S]*?# \/akaReader managed settings\s*/m;
  let config = String(existing || '').replace(managedBlock, '');
  config = upsertSetting(config, 'server.initialOpenInBrowserEnabled', 'false');
  config = upsertSetting(config, 'server.systemTrayEnabled', 'false');
  config = upsertSetting(
    config,
    'server.extensionStores',
    JSON.stringify(configuredExtensionStores(customStores)),
  );
  return config;
}

function configureCloudflareHelper(existing = '', { enabled = true, url = 'http://127.0.0.1:8191' } = {}) {
  let config = String(existing || '');
  config = upsertSetting(config, 'server.flareSolverrEnabled', enabled ? 'true' : 'false');
  config = upsertSetting(config, 'server.flareSolverrUrl', JSON.stringify(url));
  config = upsertSetting(config, 'server.flareSolverrTimeout', '60');
  config = upsertSetting(config, 'server.flareSolverrSessionName', JSON.stringify('suwayomi'));
  config = upsertSetting(config, 'server.flareSolverrSessionTtl', '15');
  config = upsertSetting(config, 'server.flareSolverrAsResponseFallback', 'true');
  return config;
}

module.exports = {
  DEFAULT_EXTENSION_STORES,
  buildSuwayomiConfig,
  configureCloudflareHelper,
  configuredExtensionStores,
  isValidExtensionStoreUrl,
  normalizeExtensionStoreUrls,
};
