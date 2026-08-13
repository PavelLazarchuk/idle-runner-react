---
'@idle-runner/react': patch
---

Stop reporting the hooks' own aborts as application errors.

- `useIdleCallback` with `abortOnUnmount: true` no longer leaves an unhandled rejection behind when the call is fire-and-forget — which is the documented way to use it (`onClick={() => track(event)}`). The unmount abort is the hook's doing, not the caller's, so it is marked handled from the `abort` listener, synchronously with the abort itself. The returned promise still rejects with the `AbortError` for anyone who awaits it, and a real failure is still reported exactly as loudly as before: the handler is attached only for a signal the hook owns, never to the promise itself.
- `useIdleMount` (and `Defer`) no longer rethrow a rejection at the application. Their task is `() => undefined` and cannot fail on its own, so a rejection is the unmount abort or a `clear(reason)` on the runner — neither of which is this component's error to raise. `clear(new Error(...))` used to escape as an uncaught exception; now it simply leaves the content unmounted.
