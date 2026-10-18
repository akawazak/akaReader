---
tags: [flow, protected-sources]
---
# Source Verification Flow
For sources behind Cloudflare / CAPTCHA. User-driven, never a silent bypass. Up: [[Home]]

1. [[Source Errors]] returns `source-verification-required`.
2. `/api/sources` includes each source's `homeUrl`, so verification works before any result loads.
3. Renderer shows compact error with **Retry** and **Verify manually** (manual stays available even while the helper starts; separate state).
4. Browse / manga-detail / chapter challenges auto-invoke recovery **once** per item (ref guard).
5. If [[FlareSolverr Helper]] installed → reuse/start it; when ready, failed request retries automatically (and completes an already-open manual view).
6. Manual: sandboxed persistent-partition `WebContentsView` inside the main window, below an app-owned toolbar (`Load now`, Cancel, Esc).
7. Electron watches readiness signals + a same-source `cf_clearance` cookie; removes the view on clearance / meaningful content / stable same-host page; never clicks or solves. ([[Electron Runtime Modules#source-verification.cjs]])
8. Still blocked and no helper → one-time checksum-verified helper install, then retry.

IPC: `verifySourceUrl`, `getSourceVerificationState`, `cancelSourceVerification`, `completeSourceVerification`, `onSourceVerificationState` ([[IPC Channels]]).
