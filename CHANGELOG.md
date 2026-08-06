# @idle-runner/react

## 1.2.1

### Patch Changes

- 6644220: Add a `size-limit` budget and enforce it in CI. `npm run size` measures the built ESM and CJS bundles (minified + brotli) and fails if they exceed the limits in `.size-limit.json`. `react` and `react-dom` are ignored as peer dependencies, while `@idle-runner/core` is counted, so the number reflects what installing this package actually costs — currently under 4 kB for the full entry point, with per-hook entries for `useIdleTask` and `useIdleValue` guarding tree-shakeability. Tooling only; the published bundle is unchanged.

## 1.2.0

### Minor Changes

- 88c4682: Forward the core runner's `priority` and `key` options through every hook that queues work — `useIdleTask`, `useIdleChunkedTask`, `useIdleEffect`, `useIdleValue`, and `useIdleCallback`. Both are opt-in and passed through unchanged to `push`/`pushChunked`; a hook that never sets either behaves exactly as before.

    - **`priority`** — `'user-blocking' | 'user-visible' | 'background'` (default `'user-visible'`), the same three FIFO buckets and `agingMs` starvation guard as the core runner. It participates in each hook's re-queue check alongside `timeout`, so changing it between renders re-queues the task at the new priority.
    - **`key`** — a `PropertyKey`; a later push with the same key — even from a different hook instance sharing a runner — supersedes an earlier pending one, which rejects with `AbortError` silently (like other aborts). This covers cross-component "only the latest matters" dedup that a single hook's own abort-on-deps-change doesn't reach, e.g. `useIdleCallback` invoked on every keystroke with a shared `key`.

    Requires `@idle-runner/core@^1.2.0`, which this package now depends on.

## 1.1.1

### Patch Changes

- 5db03f9: Improve npm/search discoverability: more descriptive `description`, added `@idle-runner/react` and related terms to `keywords`, and added npm version/downloads badges to the README.

## 1.1.0

### Minor Changes

- 36d3314: Add `useIdleChunkedTask`: a generator-based counterpart to `useIdleTask` that runs work in budgeted chunks across idle slices via the core runner's `pushChunked`, for synchronous work heavy enough that a single slice isn't enough. Same `deps`, abort-on-change-or-unmount, and `runner`/`timeout`/`enabled`/`onError` options as `useIdleTask`.

## 1.0.0

### Major Changes

- Initial release.
- TypeScript support.
- Documentation.
