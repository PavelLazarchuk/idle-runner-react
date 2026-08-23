import type { IdleRunner, TaskPriority } from '@idle-runner/core';

import { useIdleValue, type UseIdleValueResult } from './use-idle-value';

export interface UseIdleImportOptions {
    runner?: IdleRunner;
    timeout?: number;
    enabled?: boolean;
    priority?: TaskPriority;
    key?: PropertyKey;
}

/**
 * Starts a dynamic `import()` in an idle slice and reports the module as state — for a
 * chunk the page will probably need next, fetched while nothing else is competing for
 * the main thread instead of at the click that needs it.
 *
 * ```tsx
 * const { status, value } = useIdleImport(() => import('./HeavyEditor'));
 * const Editor = value?.default;
 *
 * return Editor ? <Editor /> : <EditorSkeleton />;
 * ```
 *
 * What the runner defers is the *call* to `import()`, not the network round trip: the
 * task is done the moment the import starts, and the returned promise is what the
 * state follows. That is the point — evaluating a chunk is main-thread work, and this
 * keeps it out of an interaction. `status` is `'pending'` until the module resolves,
 * then `'success'` with the module namespace, or `'error'` if the chunk failed to
 * load; `refresh()` retries, which is the recovery path for a chunk that 404'd after
 * a deploy. Nothing is queued while `enabled` is `false`, and nothing runs on the
 * server, so the first client render matches the HTML.
 *
 * `load` is read fresh on every run, so an inline arrow is fine — the import is
 * started once regardless of how often the component renders.
 */
export function useIdleImport<T>(
    load: () => Promise<T>,
    options: UseIdleImportOptions = {}
): UseIdleValueResult<T> {
    // eslint-disable-next-line react-hooks/exhaustive-deps
    return useIdleValue<T>(() => load() as unknown as T, [], options);
}
