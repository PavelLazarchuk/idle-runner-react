import { useEffect, type DependencyList } from 'react';
import type { IdleRunner, TaskPriority } from '@idle-runner/core';

import { useResolvedRunner } from './context';
import { reportTaskError, useLatest } from './internal';

export interface UseIdleChunkedTaskOptions {
    runner?: IdleRunner;
    timeout?: number;
    enabled?: boolean;
    onError?: (error: unknown) => void;
    priority?: TaskPriority;
    key?: PropertyKey;
}

/**
 * Queues a generator-based `task` when `deps` change, run in budgeted chunks across idle
 * slices instead of one step — for synchronous work heavy enough that a single slice
 * isn't enough. Aborted on the next deps change or on unmount, same as `useIdleTask`.
 *
 * ```tsx
 * useIdleChunkedTask(function* () {
 *     for (const item of items) {
 *         processItem(item);
 *         yield;
 *     }
 * }, [items]);
 * ```
 */
export function useIdleChunkedTask(
    task: () => Generator<unknown, unknown, unknown>,
    deps: DependencyList,
    options: UseIdleChunkedTaskOptions = {}
): void {
    const { runner: explicitRunner, timeout, enabled = true, onError, priority, key } = options;
    const runner = useResolvedRunner(explicitRunner);
    const taskRef = useLatest(task);
    const onErrorRef = useLatest(onError);

    useEffect(() => {
        if (!enabled) return;

        const controller = new AbortController();

        function* bridge(): Generator<unknown, unknown, unknown> {
            return yield* taskRef.current();
        }

        runner
            .pushChunked(bridge(), { signal: controller.signal, timeout, priority, key })
            .catch(error => reportTaskError(error, onErrorRef.current));

        return () => controller.abort();
        // eslint-disable-next-line react-hooks/exhaustive-deps
    }, [runner, enabled, timeout, priority, key, ...deps]);
}
