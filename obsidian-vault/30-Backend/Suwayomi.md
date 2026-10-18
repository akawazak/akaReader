---
tags: [external, java]
---
# Suwayomi
Java (21.0.11+) manga server on `:4567` that runs source extensions; akaReader's content engine. Up: [[Runtime Stack]]

- JAR bundled/downloaded as `backend/Suwayomi-Server-*.jar`, migrated into `suwayomi-runtime/` with `work/` as cwd (avoids a Windows GraphQL-init failure).
- Config `server.conf`: `server.extensionStores` ([[Extension Stores]]), FlareSolverr settings ([[FlareSolverr Helper]]).
- Spoken to by [[Backend Proxy]] via GraphQL (`fetchManga`, `fetchChapters`, `fetchChapterPages`) and REST.
- Supervised by [[Electron Main]] ([[Startup Flow]]).
