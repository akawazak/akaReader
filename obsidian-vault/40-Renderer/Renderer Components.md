---
tags: [renderer]
---
# Renderer Components
Up: [[Runtime Stack]]

| File | Role |
|---|---|
| `src/main.jsx` | React bootstrap |
| `src/components/reader/Reader.jsx` | [[Reader]] |
| `src/components/extensions/ExtensionsTab.jsx` | Extension search/filter/sort, incremental rows, `content-visibility`, install/update/remove ([[Extension Stores]]) |
| `src/components/downloads/StorageManager.jsx` | Offline bytes/pages, quota, per-title / delete-read / delete-all ([[Offline Downloads]]) |
| `src/components/manga/MangaCard.jsx` | Card/list card for library, browse, history |
| `src/views/HomeView.jsx` | Home/dashboard |
| `src/components/ui/{Badge,Btn,EmptyState,Spin}.jsx` | UI primitives (named spinner sizes) |
| `src/contexts/DataContext.jsx` | Context + `useData()` → [[DataProvider]] |
| `src/constants/index.js` | `CONFIG`, `CATEGORIES`, `THEMES` |

⚠ Many of these also exist inline in [[App-jsx|App.jsx]] — drift risk ([[Known Risks]]).
