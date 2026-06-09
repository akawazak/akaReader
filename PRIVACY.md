# Privacy

akaReader is designed as a local desktop app.

## What The App Stores Locally

- Library entries
- Reading history
- Chapter progress
- Reader settings
- Offline chapter downloads
- Local Suwayomi runtime data

Most renderer state is stored in browser storage or IndexedDB. Electron and Suwayomi runtime files live in the app data directory.

## Network Activity

akaReader connects to:

- The local backend on `localhost`
- The local Suwayomi server on `localhost`
- Source websites requested by Suwayomi/source extensions
- GitHub or release hosts when downloading app/runtime updates

akaReader does not operate a hosted content service in this repository.

## Third-Party Sources

Source extensions and upstream websites may have their own privacy practices, login requirements, rate limits, or verification challenges. akaReader cannot control those third-party services.

## Support Links

If support or donation links are added later, they should be clearly optional and should not gate access to third-party content.
