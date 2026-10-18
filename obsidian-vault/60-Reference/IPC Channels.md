---
tags: [reference, electron, ipc]
---
# IPC Channels
Generated from `manga-nexus/preload.js` → `window.electronAPI`. See [[Preload Bridge]], [[Electron Main]].

| API | Kind | Channel |
|---|---|---|
| `apiToken` | sendSync | `get-api-token` |
| `minimize` | invoke | `window-minimize` |
| `maximize` | invoke | `window-maximize` |
| `close` | invoke | `window-close` |
| `completeWindowCloseFlush` | send | `window-close-flush-complete` |
| `getCloseToTray` | invoke | `get-close-to-tray` |
| `setCloseToTray` | invoke | `set-close-to-tray` |
| `getStartWithWindows` | invoke | `get-start-with-windows` |
| `setStartWithWindows` | send | `set-start-with-windows` |
| `getDiscordPresence` | invoke | `get-discord-presence` |
| `setDiscordPresenceEnabled` | invoke | `set-discord-presence-enabled` |
| `retryDiscordPresence` | invoke | `retry-discord-presence` |
| `setDiscordPresenceMode` | invoke | `set-discord-presence-mode` |
| `getExtensionRepos` | invoke | `get-extension-repos` |
| `setExtensionRepos` | invoke | `set-extension-repos` |
| `ensureServices` | invoke | `ensure-services` |
| `restartServices` | invoke | `restart-services` |
| `getSystemDiagnostics` | invoke | `get-system-diagnostics` |
| `repairSystem` | invoke | `repair-system` |
| `rendererReady` | send | `renderer-ready` |
| `getServiceIssue` | invoke | `get-service-issue` |
| `getJavaInfo` | invoke | `get-java-info` |
| `installManagedJava` | invoke | `install-managed-java` |
| `checkService` | invoke | `check-service` |
| `installService` | invoke | `install-service` |
| `uninstallService` | invoke | `uninstall-service` |
| `openDataDir` | invoke | `open-data-dir` |
| `exportChapterCbz` | invoke | `export-chapter-cbz` |
| `exportMangaCbz` | invoke | `export-manga-cbz` |
| `exportAppBackup` | invoke | `export-app-backup` |
| `importAppBackup` | invoke | `import-app-backup` |
| `saveAutomaticBackup` | invoke | `save-automatic-backup` |
| `getJarPath` | invoke | `get-jar-path` |
| `getJavaPath` | invoke | `get-java-path` |
| `getSuwayomiConfigPath` | invoke | `get-suwayomi-config-path` |
| `getVersion` | invoke | `get-version` |
| `openExternal` | invoke | `open-external` |
| `showNotification` | invoke | `show-notification` |
| `getCloudflareHelperInfo` | invoke | `get-cloudflare-helper-info` |
| `ensureCloudflareHelper` | invoke | `ensure-cloudflare-helper` |
| `setupCloudflareHelper` | invoke | `setup-cloudflare-helper` |
| `verifySourceUrl` | invoke | `verify-source-url` |
| `getSourceVerificationState` | invoke | `get-source-verification-state` |
| `cancelSourceVerification` | invoke | `cancel-source-verification` |
| `completeSourceVerification` | invoke | `complete-source-verification` |
| `checkForAppUpdate` | invoke | `check-for-app-update` |
| `downloadAppUpdate` | invoke | `download-app-update` |
| `installAppUpdate` | invoke | `install-app-update` |
| `reinstallBackend` | invoke | `reinstall-backend` |
| `factoryReset` | invoke | `factory-reset` |
| `onBeforeWindowClose` | on (main→renderer) | `before-window-close` |
| `onServicesStatus` | on (main→renderer) | `services-status` |
| `onDiscordPresenceStatus` | on (main→renderer) | `discord-presence-status` |
| `onSourceVerificationState` | on (main→renderer) | `source-verification-state` |

