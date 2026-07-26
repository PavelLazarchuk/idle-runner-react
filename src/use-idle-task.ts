import { useEffect, type DependencyList } from 'react';
import type { IdleRunner } from '@idle-runner/core';

import { useResolvedRunner } from './context';
import { reportTaskError, useLatest } from './internal';

export interface UseIdleTaskOptions {
    runner?: IdleRunner;
    timeout?: number;
    enabled?: boolean;
    onError?: (error: unknown) => void;
}

/**
 * Queues `task` when `deps` change and aborts it on the next change or on unmount, so a
 * task that has not started yet never runs against props that are already gone.
 *
 * ```tsx
 * useIdleTask(() => warmImageCache(products), [products]);
 * ```
 */
export function useIdleTask(
    task: () => unknown,
    deps: DependencyList,
    options: UseIdleTaskOptions = {}
): void {
    const { runner: explicitRunner, timeout, enabled = true, onError } = options;
    const runner = useResolvedRunner(explicitRunner);
    const taskRef = useLatest(task);
    const onErrorRef = useLatest(onError);

    useEffect(() => {
        if (!enabled) return;

        const controller = new AbortController();
        runner
            .push(() => taskRef.current(), { signal: controller.signal, timeout })
            .catch(error => reportTaskError(error, onErrorRef.current));

        return () => controller.abort();
        // eslint-disable-next-line react-hooks/exhaustive-deps
    }, [runner, enabled, timeout, ...deps]);
}
