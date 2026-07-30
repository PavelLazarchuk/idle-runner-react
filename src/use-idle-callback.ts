import { useCallback, useEffect, useRef } from 'react';
import type { IdleRunner, TaskPriority } from '@idle-runner/core';

import { useResolvedRunner } from './context';
import { useLatest } from './internal';

export interface UseIdleCallbackOptions {
    runner?: IdleRunner;
    timeout?: number;
    abortOnUnmount?: boolean;
    priority?: TaskPriority;
    key?: PropertyKey;
}

/**
 * A stable function that queues `callback` instead of running it inline — for work an
 * event handler starts but nothing is waiting on, so the interaction stays fast.
 *
 * ```tsx
 * const track = useIdleCallback((event: ClickEvent) => sendAnalytics(event));
 * <button onClick={() => track(event)} />
 * ```
 *
 * The returned promise settles with the callback's result; rejections belong to the
 * caller, so handle them where you call it.
 */
export function useIdleCallback<A extends unknown[], T>(
    callback: (...args: A) => T,
    options: UseIdleCallbackOptions = {}
): (...args: A) => Promise<T> {
    const { runner: explicitRunner, timeout, abortOnUnmount = false, priority, key } = options;
    const runner = useResolvedRunner(explicitRunner);
    const callbackRef = useLatest(callback);
    const abortOnUnmountRef = useLatest(abortOnUnmount);
    const controllerRef = useRef<AbortController | null>(null);

    useEffect(() => {
        if (controllerRef.current?.signal.aborted) controllerRef.current = null;

        return () => {
            // eslint-disable-next-line react-hooks/exhaustive-deps
            if (abortOnUnmountRef.current) controllerRef.current?.abort();
        };
    }, [abortOnUnmountRef]);

    return useCallback(
        (...args: A) => {
            let signal: AbortSignal | undefined;

            if (abortOnUnmount) {
                controllerRef.current ??= new AbortController();
                signal = controllerRef.current.signal;
            }

            return runner.push(() => callbackRef.current(...args), {
                signal,
                timeout,
                priority,
                key,
            });
        },
        [runner, timeout, abortOnUnmount, priority, key, callbackRef]
    );
}
