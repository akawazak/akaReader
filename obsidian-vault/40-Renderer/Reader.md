---
tags: [renderer, high-risk]
file: manga-nexus/src/components/reader/Reader.jsx
---
# Reader
`manga-nexus/src/components/reader/Reader.jsx` (~1.3k lines). Up: [[Reader Flow]]

- Modes: paged, scroll, webtoon.
- Receives initial pages, current chapter, nav callbacks, persisted initial page from [[App-jsx|App.jsx]].
- Flattens `loadedChapters` → `allPages`.
- Scroll/webtoon: `IntersectionObserver` tracks most-visible page → persists immediately via [[DataProvider]].
- Paged: keyboard / tap / wheel handlers.
- Zoom 50–500% (toolbar, slider, shortcuts, Ctrl+wheel; double-spread shares rules) — `utils/readerZoom.mjs`.
- Near end → `fetchNextChapter()` appends next chapter in-session; prefetch uses `AbortController`.
- Synchronous checkpoint on visibility loss, `pagehide`, exit, teardown, and native close flush ([[Electron Main#Close handshake]]).
- Settings drawer is an accessible modal (focus in/out, labelled controls) — `readerAccessibility.test.mjs`.
- Known risk: adaptive color extraction image loads aren't cancelled ([[Known Risks]]).

Always inspect together with [[App-jsx|App.jsx]] ([[Agent Rules]]).
