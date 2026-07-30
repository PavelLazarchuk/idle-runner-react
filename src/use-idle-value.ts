import { useCallback, useEffect, useMemo, useState, type DependencyList } from 'react';
import type { IdleRunner, TaskPriority } from '@idle-runner/core';

import { useResolvedRunner } from './context';
import { isAbortError, useLatest } from './internal';

export type IdleValueStatus = 'idle' | 'pending' | 'success' | 'error';

export type IdleValueState<T> =
    | { status: 'idle'; value: undefined; error: undefined }
    | { status: 'pending'; value: undefined; error: undefined }
    | { status: 'success'; value: T; error: undefined }
    | { status: 'error'; value: undefined; error: unknown };

export type UseIdleValueResult<T> = IdleValueState<T> & {
    refresh: () => void;
};

export interface UseIdleValueOptions {
    runner?: IdleRunner;
    timeout?: number;
    enabled?: boolean;
    priority?: TaskPriority;
    key?: PropertyKey;
}

const IDLE_STATE = { status: 'idle', value: undefined, error: undefined } as const;
const PENDING_STATE = { status: 'pending', value: undefined, error: undefined } as const;

function sameInputs(left: readonly unknown[], right: readonly unknown[]): boolean {
    return (
        left.length === right.length && left.every((item, index) => Object.is(item, right[index]))
    );
}

/**
 * Computes a value off the critical path and reports it as state.
 *
 * ```tsx
 * const { status, value } = useIdleValue(() => buildSearchIndex(products), [products]);
 * ```
 *
 * A deps change goes back to `pending` and abandons the in-flight computation — the
 * result of a superseded run is never written to state.
 */
export function useIdleValue<T>(
    compute: () => T,
    deps: DependencyList,
    options: UseIdleValueOptions = {}
): UseIdleValueResult<T> {
    const { runner: explicitRunner, timeout, enabled = true, priority, key } = options;
    const runner = useResolvedRunner(explicitRunner);
    const computeRef = useLatest(compute);
    const [nonce, setNonce] = useState(0);
    const [state, setState] = useState<IdleValueState<T>>(enabled ? PENDING_STATE : IDLE_STATE);
    const inputs: unknown[] = [runner, enabled, timeout, priority, key, nonce, ...deps];
    const [lastInputs, setLastInputs] = useState(inputs);

    if (!sameInputs(lastInputs, inputs)) {
        setLastInputs(inputs);
        setState(enabled ? PENDING_STATE : IDLE_STATE);
    }

    useEffect(() => {
        if (!enabled) {
            setState(IDLE_STATE);

            return;
        }

        setState(PENDING_STATE);
        const controller = new AbortController();

        runner
            .push(() => computeRef.current(), { signal: controller.signal, timeout, priority, key })
            .then(
                value => {
                    if (!controller.signal.aborted) {
                        setState({ status: 'success', value, error: undefined });
                    }
                },
                error => {
                    if (isAbortError(error) || controller.signal.aborted) return;

                    setState({ status: 'error', value: undefined, error });
                }
            );

        return () => controller.abort();
        // eslint-disable-next-line react-hooks/exhaustive-deps
    }, [runner, enabled, timeout, priority, key, nonce, ...deps]);

    const refresh = useCallback(() => setNonce(current => current + 1), []);

    return useMemo(() => ({ ...state, refresh }) as UseIdleValueResult<T>, [state, refresh]);
}
