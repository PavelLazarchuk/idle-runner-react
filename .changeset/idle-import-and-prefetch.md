---
'@idle-runner/react': minor
---

Prefetching chunks and URLs from an idle slice.

- New `useIdleImport(load, options?)`: starts a dynamic `import()` once the page goes idle and reports the module through the same state machine as `useIdleValue` — `pending`, then `success` with the module namespace or `error` for a chunk that failed to load, with `refresh()` as the retry. What is deferred is the call to `import()`, so the queue empties while the module is still in flight; parsing and evaluating the chunk is the main-thread work this keeps out of an interaction.
- New `useIdlePrefetch(url, options?)`: warms one URL or an array of them in an idle slice. Injects `<link rel="prefetch">` where the browser supports it and falls back to a low-priority `fetch` where it does not — Safari, which has never shipped `rel="prefetch"` either. Each URL is warmed once per document however many components ask for it, a URL still queued on unmount is dropped, and a metered or 2g connection is skipped entirely unless `respectSaveData: false`. Takes `as`, `crossOrigin` and `onError`, and defaults to `priority: 'background'`.
