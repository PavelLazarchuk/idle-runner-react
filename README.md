# @idle-runner/react

[![npm version](https://img.shields.io/npm/v/@idle-runner/react.svg)](https://www.npmjs.com/package/@idle-runner/react)
[![npm downloads](https://img.shields.io/npm/dm/@idle-runner/react.svg)](https://www.npmjs.com/package/@idle-runner/react)

React hooks for [`@idle-runner/core`](https://github.com/PavelLazarchuk/idle-runner-core): run non-urgent work from components without blocking the main thread. Zero runtime dependencies of its own, **works on Safari** — where `requestIdleCallback` has never shipped enabled.

Every hook here queues work on a runner instead of running it in the render or effect phase, and cancels that work when the component that asked for it goes away.

## Install

```sh
npm install @idle-runner/react
```

`@idle-runner/core` comes with it as a dependency; `react` is the only peer. If you also use the core API directly, importing `@idle-runner/core` in your own code resolves to the same installed copy — so `sharedRunner()` is genuinely one queue per page.

## Quick start

```tsx
import { useIdleTask, useIdleValue } from '@idle-runner/react';

function ProductList({ products }: { products: Product[] }) {
    // Fire-and-forget: queued after paint, aborted if `products` changes or the
    // component unmounts before it ever ran.
    useIdleTask(() => warmImageCache(products), [products]);

    // Same deal, but you want the result on screen when it is ready.
    const { status, value: index } = useIdleValue(() => buildSearchIndex(products), [products]);

    return <Search index={status === 'success' ? index : null} />;
}
```

No provider is required: hooks default to the shared page-wide runner from `sharedRunner()`.

## Hooks

### `useIdleTask(task, deps, options?)`

Queues `task` when `deps` change. The work is aborted on the next deps change or on unmount, so a task that has not started yet never runs against props that are already gone.

```tsx
useIdleTask(() => reportImpression(id), [id], { timeout: 2000 });
```

| Option     | Type                                                | Default          | Description                                                                                                                                                                                              |
| ---------- | --------------------------------------------------- | ---------------- | -------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| `runner`   | `IdleRunner`                                        | provider         | Queue on a specific runner instead of the contextual one.                                                                                                                                                |
| `timeout`  | `number`                                            | —                | Force the task to run after this many ms, idle or not.                                                                                                                                                   |
| `enabled`  | `boolean`                                           | `true`           | Queue nothing while `false`.                                                                                                                                                                             |
| `onError`  | `(error: unknown) => void`                          | —                | Receives failures. Without it, see [Errors](#errors).                                                                                                                                                    |
| `priority` | `'user-blocking' \| 'user-visible' \| 'background'` | `'user-visible'` | Forwarded to the runner's `push`. See core's [Priority](https://github.com/PavelLazarchuk/idle-runner-core#priority) docs.                                                                               |
| `key`      | `PropertyKey`                                       | —                | Forwarded to the runner's `push`; a later call with the same key supersedes an earlier pending one. See [Deduplicating by key](https://github.com/PavelLazarchuk/idle-runner-core#deduplicating-by-key). |

The task itself is always the newest closure from the last render — it is not part of `deps`.

### `useIdleChunkedTask(task, deps, options?)`

Like `useIdleTask`, but for a generator: instead of running to completion in one idle slice, it runs in budgeted chunks, yielding control back between them so a long computation never becomes a long task.

```tsx
useIdleChunkedTask(
    function* () {
        for (const item of items) {
            processItem(item);
            yield;
        }
    },
    [items]
);
```

Same options as `useIdleTask` — `runner`, `timeout`, `enabled`, `onError`, `priority`, `key` — and the same abort-on-deps-change-or-unmount behavior. A `yield` is a checkpoint the runner can pause at, not a promise — the generator itself must stay synchronous. A `priority` change is also what lets a suspended chunked generator be parked for genuinely higher-priority work and resumed later — see core's [Priority](https://github.com/PavelLazarchuk/idle-runner-core#priority) docs.

### `useIdleValue(compute, deps, options?)`

Computes a value off the critical path and reports it as state:

```tsx
const { status, value, error, refresh } = useIdleValue(() => buildIndex(items), [items]);
```

| `status`    | meaning                                      |
| ----------- | -------------------------------------------- |
| `'pending'` | queued or running; `value` is `undefined`    |
| `'success'` | `value` holds the result                     |
| `'error'`   | `compute` threw; `error` holds what it threw |
| `'idle'`    | `enabled: false` — nothing was queued        |

A deps change goes back to `pending` in the same render — the previous value is never painted next to the new deps — and abandons the in-flight computation: the result of a superseded run is never written to state. `refresh()` recomputes without a deps change and keeps a stable identity across renders.

Options: `runner`, `timeout`, `enabled`, `priority`, `key` (as above).

### `useIdleCallback(callback, options?)`

A stable function that queues `callback` instead of running it inline — for work an event handler starts but nothing is waiting on:

```tsx
const track = useIdleCallback((event: ClickEvent) => sendAnalytics(event));

<button onClick={event => void track(event)}>Buy</button>;
```

The returned promise settles with the callback's result, so **rejections are yours to handle** at the call site. The function identity is stable across renders while always calling the newest closure.

| Option           | Type                                                | Default          | Description                                                                                                                                                                         |
| ---------------- | --------------------------------------------------- | ---------------- | ----------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| `runner`         | `IdleRunner`                                        | provider         | Queue on a specific runner.                                                                                                                                                         |
| `timeout`        | `number`                                            | —                | Force the call to run after this many ms.                                                                                                                                           |
| `abortOnUnmount` | `boolean`                                           | `false`          | Abort still-queued calls on unmount; their promises reject with an `AbortError`.                                                                                                    |
| `priority`       | `'user-blocking' \| 'user-visible' \| 'background'` | `'user-visible'` | Forwarded to every queued call. See core's [Priority](https://github.com/PavelLazarchuk/idle-runner-core#priority) docs.                                                            |
| `key`            | `PropertyKey`                                       | —                | Forwarded to every queued call; calling it again before an earlier call ran supersedes that one — handy for "only the latest call matters" handlers like a search box's `onChange`. |

`abortOnUnmount` is off by default on purpose: work started by a click usually still wants to finish even if the component that scheduled it is gone.

### `useIdleEffect(effect, deps, options?)`

`useEffect` deferred to an idle period, for setup nothing on screen is waiting for:

```tsx
useIdleEffect(() => {
    const observer = observeRoutes(routes);

    return () => observer.disconnect();
}, [routes]);
```

The returned cleanup runs on the next deps change or unmount, and only if the effect body actually ran — an effect still sitting in the queue is aborted instead. Options: `runner`, `timeout`, `enabled`, `onError`, `priority`, `key`.

### `useIdleRunner(options?)`

A runner owned by the component, destroyed on unmount so its page-lifecycle listeners and queued tasks go with it. Options are read once, when the instance is created.

```tsx
const runner = useIdleRunner({ budgetMs: 10 });

useIdleTask(() => precompute(target), [target], { runner });
```

Reach for it only when you need a queue with its own budget or one you can `clear()` wholesale. Otherwise the shared runner is the right default — a second runner does not get a second main thread, it just splits the budget.

### `IdleRunnerProvider` / `useIdleRunnerContext()`

Points every hook in a subtree at one runner:

```tsx
function App() {
    const runner = useIdleRunner({ budgetMs: 8 });

    return (
        <IdleRunnerProvider runner={runner}>
            <Routes />
        </IdleRunnerProvider>
    );
}
```

Resolution order is: the per-hook `runner` option → the nearest provider that was given a runner → `sharedRunner()`. A provider rendered without one is transparent: it inherits the provider above it, so `<IdleRunnerProvider runner={props.runner}>` is safe to nest when the prop is optional. `useIdleRunnerContext()` returns the same runner the hooks would use, for the rare case you want to call `push`/`clear` directly.

## Errors

`useIdleTask` and `useIdleEffect` do not return a promise, so there is nowhere for a failure to go by default. They take an `onError` instead:

```tsx
useIdleTask(() => JSON.parse(maybeInvalid), [maybeInvalid], { onError: reportToSentry });
```

Without `onError`, a failure is rethrown out of band rather than swallowed into a queue nobody is watching — it surfaces as an uncaught error, the way a throw from an effect would. Aborts are never reported: unmounting during a queued task is a requested outcome, not an error.

`useIdleValue` puts failures in `status: 'error'`; `useIdleCallback` rejects the promise it returns.

## StrictMode, SSR and Next.js

- **StrictMode** — the double-mount is handled: `useIdleRunner` hands out a live replacement after the first cleanup destroys its instance, and every hook re-queues its work on the second effect run.
- **SSR** — hooks queue nothing on the server, because effects never run there. `useIdleValue` renders as `pending`, and no host global is touched. Covered by [`test/ssr.test.tsx`](test/ssr.test.tsx).
- **Next.js App Router** — the built entry carries a `"use client"` directive, so importing the hooks into a client component needs no extra ceremony.

## When to use this — and when not to

Same rules as the core package: this defers work on the main thread, it does not offload it.

**Good fits** — prefetching, warming caches and derived indexes, analytics flushes, hydrating below-the-fold widgets.

**Bad fits:**

- ❌ **Anything the next paint depends on.** Deferring the total the user is watching makes INP worse, not better.
- ❌ **Genuinely heavy, parallelizable work** — a 200ms computation is still 200ms. Chunk it with `useIdleChunkedTask`, or move it to a Web Worker.
- ❌ **Data fetching.** These hooks queue synchronous work; a promise returned from a task is a value the runner resolves with, not something it waits on.

## Tests

The suite runs three ways: jsdom for the hook semantics (with a scripted scheduler, so "queued" and "ran" are separate observable steps), Node for the SSR pass, and **Chromium plus WebKit** through Playwright against the real scheduler — the Safari path being the one that exists precisely because `requestIdleCallback` does not.

## License

MIT
