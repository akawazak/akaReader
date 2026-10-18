---
tags: [backend]
file: backend/source-errors.js
---
# Source Errors
`backend/source-errors.js` — classifies Suwayomi source failures into short structured JSON. Up: [[Backend Proxy]]

- Cloudflare / CAPTCHA / helper-connection failures → code **`source-verification-required`** → triggers [[Source Verification Flow]].
- Other failures → first-line explanation only; Java/Kotlin stacks stripped.
- Renderer counterpart: `src/utils/sourceErrors.mjs` ([[Renderer Utils]]).

Tests: `backend/test/source-errors.test.js`, `manga-nexus/test/sourceErrors.test.mjs`.
