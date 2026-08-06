---
'@idle-runner/react': patch
---

Add a `size-limit` budget and enforce it in CI. `npm run size` measures the built ESM and CJS bundles (minified + brotli) and fails if they exceed the limits in `.size-limit.json`. `react` and `react-dom` are ignored as peer dependencies, while `@idle-runner/core` is counted, so the number reflects what installing this package actually costs — currently under 4 kB for the full entry point, with per-hook entries for `useIdleTask` and `useIdleValue` guarding tree-shakeability. Tooling only; the published bundle is unchanged.
