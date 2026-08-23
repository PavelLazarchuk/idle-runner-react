# @idle-runner/react

## 1.4.0

### Minor Changes

- 74f82d5: Prefetching chunks and URLs from an idle slice.

    - New `useIdleImport(load, options?)`: starts a dynamic `import()` once the page goes idle and reports the module through the same state machine as `useIdleValue` — `pending`, then `success` with the module namespace or `error` for a chunk that failed to load, with `refresh()` as the retry. What is deferred is the call to `import()`, so the queue empties while the module is still in flight; parsing and evaluating the chunk is the main-thread work this keeps out of an interaction.
    - New `useIdlePrefetch(url, options?)`: warms one URL or an array of them in an idle slice. Injects `<link rel="prefetch">` where the browser supports it and falls back to a low-priority `fetch` where it does not — Safari, which has never shipped `rel="prefetch"` either. Each URL is warmed once per document however many components ask for it, a URL still queued on unmount is dropped, and a metered or 2g connection is skipped entirely unless `respectSaveData: false`. Takes `as`, `crossOrigin` and `onError`, and defaults to `priority: 'background'`.

## 1.3.1

### Patch Changes

- 88dd5b0: Stop reporting the hooks' own aborts as application errors.

    - `useIdleCallback` with `abortOnUnmount: true` no longer leaves an unhandled rejection behind when the call is fire-and-forget — which is the documented way to use it (`onClick={() => track(event)}`). The unmount abort is the hook's doing, not the caller's, so it is marked handled from the `abort` listener, synchronously with the abort itself. The returned promise still rejects with the `AbortError` for anyone who awaits it, and a real failure is still reported exactly as loudly as before: the handler is attached only for a signal the hook owns, never to the promise itself.
    - `useIdleMount` (and `Defer`) no longer rethrow a rejection at the application. Their task is `() => undefined` and cannot fail on its own, so a rejection is the unmount abort or a `clear(reason)` on the runner — neither of which is this component's error to raise. `clear(new Error(...))` used to escape as an uncaught exception; now it simply leaves the content unmounted.

## 1.3.0

### Minor Changes

- 572e7d0: Progress reporting and idle mounting.

    - `useIdleChunkedTask` accepts `onProgress`, called with every value the generator yields — read through a ref, so an inline arrow does not re-queue the task, and a throw inside it warns instead of failing the task. The generator's own `finally` still runs when an abort closes it.
    - New `useIdleMount(options?)`: `false` until the page goes idle, then `true`, for mounting a heavy subtree after the first paint. `false` on the server and in the first client render, so the fallback is what hydrates.
    - New `<Defer fallback={...}>`: `useIdleMount` as a component.

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
