import { useEffect, type DependencyList } from 'react';
import type { IdleRunner, TaskPriority } from '@idle-runner/core';

import { useResolvedRunner } from './context';
import { devWarn, reportTaskError, useLatest } from './internal';

export interface UseIdleChunkedTaskOptions<P = unknown> {
    runner?: IdleRunner;
    timeout?: number;
    enabled?: boolean;
    onError?: (error: unknown) => void;
    priority?: TaskPriority;
    key?: PropertyKey;
    onProgress?: (value: P) => void;
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
 *
 * Yielded values are reported to `onProgress`, which turns `yield` into a progress
 * channel:
 *
 * ```tsx
 * const [done, setDone] = useState(0);
 *
 * useIdleChunkedTask(function* () {
 *     for (const [index, item] of items.entries()) {
 *         processItem(item);
 *         yield index + 1;
 *     }
 * }, [items], { onProgress: setDone });
 * ```
 */
export function useIdleChunkedTask<P = unknown>(
    task: () => Generator<P, unknown, unknown>,
    deps: DependencyList,
    options: UseIdleChunkedTaskOptions<P> = {}
): void {
    const {
        runner: explicitRunner,
        timeout,
        enabled = true,
        onError,
        priority,
        key,
        onProgress,
    } = options;
    const runner = useResolvedRunner(explicitRunner);
    const taskRef = useLatest(task);
    const onErrorRef = useLatest(onError);
    const onProgressRef = useLatest(onProgress);

    useEffect(() => {
        if (!enabled) return;

        const controller = new AbortController();

        function* bridge(): Generator<P, unknown, unknown> {
            const generator = taskRef.current();

            try {
                let step = generator.next();

                while (!step.done) {
                    reportProgress(step.value, onProgressRef.current);
                    yield step.value;
                    step = generator.next();
                }

                return step.value;
            } finally {
                generator.return?.(undefined);
            }
        }

        runner
            .pushChunked(bridge(), { signal: controller.signal, timeout, priority, key })
            .catch(error => reportTaskError(error, onErrorRef.current));

        return () => controller.abort();
        // eslint-disable-next-line react-hooks/exhaustive-deps
    }, [runner, enabled, timeout, priority, key, ...deps]);
}

function reportProgress<P>(value: P, onProgress: ((value: P) => void) | undefined): void {
    if (!onProgress) return;

    try {
        onProgress(value);
    } catch {
        devWarn('onProgress threw');
    }
}
