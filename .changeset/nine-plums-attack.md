---
'@idle-runner/react': minor
---

Add `useIdleChunkedTask`: a generator-based counterpart to `useIdleTask` that runs work in budgeted chunks across idle slices via the core runner's `pushChunked`, for synchronous work heavy enough that a single slice isn't enough. Same `deps`, abort-on-change-or-unmount, and `runner`/`timeout`/`enabled`/`onError` options as `useIdleTask`.
