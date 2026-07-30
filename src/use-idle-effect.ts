import { useEffect, type DependencyList } from 'react';
import type { IdleRunner, TaskPriority } from '@idle-runner/core';

import { useResolvedRunner } from './context';
import { reportTaskError, useLatest } from './internal';

export type IdleEffectCleanup = (() => void) | void;

export interface UseIdleEffectOptions {
    runner?: IdleRunner;
    timeout?: number;
    enabled?: boolean;
    onError?: (error: unknown) => void;
    priority?: TaskPriority;
    key?: PropertyKey;
}

/**
 * `useEffect` deferred to an idle period — for setup nothing on screen is waiting for,
 * like prefetching or warming a cache.
 *
 * ```tsx
 * useIdleEffect(() => {
 *     const observer = observeRoutes(routes);
 *
 *     return () => observer.disconnect();
 * }, [routes]);
 * ```
 *
 * The returned cleanup runs on the next deps change or unmount, and only if the effect
 * body actually ran: an effect still sitting in the queue is aborted instead.
 */
export function useIdleEffect(
    effect: () => IdleEffectCleanup,
    deps: DependencyList,
    options: UseIdleEffectOptions = {}
): void {
    const { runner: explicitRunner, timeout, enabled = true, onError, priority, key } = options;
    const runner = useResolvedRunner(explicitRunner);
    const effectRef = useLatest(effect);
    const onErrorRef = useLatest(onError);

    useEffect(() => {
        if (!enabled) return;

        const controller = new AbortController();
        let cleanup: IdleEffectCleanup;

        runner
            .push(
                () => {
                    cleanup = effectRef.current();
                },
                { signal: controller.signal, timeout, priority, key }
            )
            .catch(error => reportTaskError(error, onErrorRef.current));

        return () => {
            controller.abort();
            const dispose = cleanup;
            cleanup = undefined;
            dispose?.();
        };
        // eslint-disable-next-line react-hooks/exhaustive-deps
    }, [runner, enabled, timeout, priority, key, ...deps]);
}
