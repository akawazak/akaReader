const path = require('node:path');

const FLARESOLVERR_VERSION = '3.5.0';
const SUWAYOMI_CLOUDFLARE_SESSION = 'suwayomi';
const MANAGED_CLOUDFLARE_RELEASES = Object.freeze({
  'win32-x64': Object.freeze({
    version: FLARESOLVERR_VERSION,
    archiveName: 'flaresolverr-download.zip',
    assetName: 'flaresolverr_windows_x64.zip',
    executableName: 'flaresolverr.exe',
    size: 325907053,
    sha256: '76a6c3e43af7de3827b2ea1badf2bb607f664caa445cef3f14d624b421f7e01e',
  }),
  'linux-x64': Object.freeze({
    version: FLARESOLVERR_VERSION,
    archiveName: 'flaresolverr-download.tar.gz',
    assetName: 'flaresolverr_linux_x64.tar.gz',
    executableName: 'flaresolverr',
    size: 233715222,
    sha256: '05551d5846cfffd62c3ea24e2d70af5de314470fc7fd5434b3ca130616092b33',
  }),
});

function getManagedCloudflareRelease(platform, arch) {
  const release = MANAGED_CLOUDFLARE_RELEASES[`${platform}-${arch}`];
  if (!release) return null;
  return {
    ...release,
    url: `https://github.com/FlareSolverr/FlareSolverr/releases/download/v${release.version}/${release.assetName}`,
  };
}

function hasCloudflareSession(response, sessionName = SUWAYOMI_CLOUDFLARE_SESSION) {
  if (!response || !Array.isArray(response.sessions)) return false;
  return response.sessions.some(session => (
    session === sessionName || session?.session === sessionName || session?.id === sessionName
  ));
}

function buildManagedCloudflareRuntime(baseEnv, userData, sessionId, platform = process.platform) {
  const safeSessionId = String(sessionId || '').replace(/[^a-zA-Z0-9_-]/g, '');
  if (!userData || !safeSessionId) throw new Error('A managed helper session directory is required.');

  const platformPath = platform === 'win32' ? path.win32 : path.posix;
  const rootDir = platformPath.join(userData, 'flaresolverr-sessions');
  const sessionDir = platformPath.join(rootDir, safeSessionId);
  const sharedAppDataDir = baseEnv.APPDATA || platformPath.dirname(userData);
  const privatePlatformEnv = platform === 'win32'
    ? { APPDATA: sessionDir, LOCALAPPDATA: sessionDir }
    : {
        XDG_CACHE_HOME: sessionDir,
        XDG_CONFIG_HOME: sessionDir,
        XDG_DATA_HOME: sessionDir,
      };
  return {
    rootDir,
    sessionDir,
    sharedDriverPath: platformPath.join(sharedAppDataDir, 'undetected_chromedriver', 'chromedriver.exe'),
    env: {
      ...baseEnv,
      // Some FlareSolverr builds honor these paths. The packaged Windows build
      // can still resolve its driver through the Windows known-folder API, so
      // Electron also cleans up only that exact managed driver process.
      ...privatePlatformEnv,
      // The helper is headless and akaReader only needs the returned HTML and
      // cookies, so images/fonts/styles needlessly slow protected requests.
      DISABLE_MEDIA: 'true',
    },
  };
}

module.exports = {
  FLARESOLVERR_VERSION,
  SUWAYOMI_CLOUDFLARE_SESSION,
  buildManagedCloudflareRuntime,
  getManagedCloudflareRelease,
  hasCloudflareSession,
};
