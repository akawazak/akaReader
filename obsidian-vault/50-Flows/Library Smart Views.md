---
tags: [flow, library]
---
# Library Smart Views
`libraryFilters.mjs`. Up: [[Home]]

Categories and smart views are **separate, combinable** filters; search + sort run after both.

- **Continue** — has progress
- **Unread** — pending updates first, else unique read IDs vs known total
- **Updated** — pending [[Chapter Updates]]
- **Offline** — has stored chapters ([[Offline Downloads]])
- **Completed**

All derived from stable IDs/keys, never by parsing chapter labels.
