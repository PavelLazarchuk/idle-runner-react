---
'@idle-runner/react': minor
---

Forward the core runner's `priority` and `key` options through every hook that queues work — `useIdleTask`, `useIdleChunkedTask`, `useIdleEffect`, `useIdleValue`, and `useIdleCallback`. Both are opt-in and passed through unchanged to `push`/`pushChunked`; a hook that never sets either behaves exactly as before.

- **`priority`** — `'user-blocking' | 'user-visible' | 'background'` (default `'user-visible'`), the same three FIFO buckets and `agingMs` starvation guard as the core runner. It participates in each hook's re-queue check alongside `timeout`, so changing it between renders re-queues the task at the new priority.
- **`key`** — a `PropertyKey`; a later push with the same key — even from a different hook instance sharing a runner — supersedes an earlier pending one, which rejects with `AbortError` silently (like other aborts). This covers cross-component "only the latest matters" dedup that a single hook's own abort-on-deps-change doesn't reach, e.g. `useIdleCallback` invoked on every keystroke with a shared `key`.

Requires `@idle-runner/core@^1.2.0`, which this package now depends on.
