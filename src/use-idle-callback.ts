import { useCallback, useEffect, useRef } from 'react';
import type { IdleRunner, TaskPriority } from '@idle-runner/core';

import { useResolvedRunner } from './context';
import { useLatest } from './internal';

function noop(): void {}

function ignoreAbortRejection(promise: Promise<unknown>, signal: AbortSignal): void {
    if (signal.aborted) {
        promise.catch(noop);

        return;
    }

    signal.addEventListener('abort', () => promise.catch(noop), { once: true });
}

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
 * caller, so handle them where you call it. The exception is the `AbortError` from
 * `abortOnUnmount`, which the hook causes rather than the caller: the promise still
 * rejects with it, but a fire-and-forget call is not reported as an unhandled
 * rejection for unmounting.
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

            const promise = runner.push(() => callbackRef.current(...args), {
                signal,
                timeout,
                priority,
                key,
            });

            if (signal) ignoreAbortRejection(promise, signal);

            return promise;
        },
        [runner, timeout, abortOnUnmount, priority, key, callbackRef]
    );
}
