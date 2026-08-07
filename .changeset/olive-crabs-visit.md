---
'@idle-runner/react': minor
---

Progress reporting and idle mounting.

- `useIdleChunkedTask` accepts `onProgress`, called with every value the generator yields — read through a ref, so an inline arrow does not re-queue the task, and a throw inside it warns instead of failing the task. The generator's own `finally` still runs when an abort closes it.
- New `useIdleMount(options?)`: `false` until the page goes idle, then `true`, for mounting a heavy subtree after the first paint. `false` on the server and in the first client render, so the fallback is what hydrates.
- New `<Defer fallback={...}>`: `useIdleMount` as a component.
