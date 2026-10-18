---
tags: [renderer, state]
---
# DataProvider
Defined in [[App-jsx|App.jsx]]; context + `useData()` hook in `src/contexts/DataContext.jsx`. No external state lib.

## Persisted state
`library`, `history`, `progress`, `mangaCategories`, `readChapters`, `readingTime`, `settings` → `localStorage` ([[Persistence Keys]]).

## Service/network state
`backendOnline`, `suwayomiReady`, `sources`, `extensions`, `updates`, chapter-update state, `downloadQueue`.

## Notes
- Page progress + reading time are written **synchronously** before React state propagates (survives hide / teardown / Alt+F4). → [[Reader Flow]]
- Giant `useMemo` provider value = large rerender surface (P1 in [[Known Risks]]).
- Service online state comes from both `/api/health` polling and Electron events — can briefly disagree.
