---
tags: [architecture, renderer]
---
# Navigation
Up: [[App-jsx|App.jsx]]

No router library. Manual state machine in [[App-jsx|App.jsx]] via `tab` + `view`:

- `view`: `tabs` (tabbed home) · `source` (browse results) · `manga` (detail) · `reader`
- `tab`: home/discover, library, browse, updates, downloads, extensions, settings…
- Back is custom `goBack()`; keyboard/back-button handling is custom.
- Transitions depend on coordinated state updates, not URLs.

Browse results own their own pagination state → [[Browse Pagination]].
