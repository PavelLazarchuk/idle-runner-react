import { useLayoutEffect } from 'react';
import { describe, expect, it, vi } from 'vitest';
import { act, renderHook } from '@testing-library/react';
import { useIdleValue } from '../src/index';
import { createTestRunner, runSlice, withRunner } from './harness';

describe('useIdleValue', () => {
    it('starts pending and settles with the computed value', async () => {
        const { runner, scheduler } = createTestRunner();
        const { result } = renderHook(() => useIdleValue(() => 6 * 7, []), {
            wrapper: withRunner(runner),
        });

        expect(result.current).toMatchObject({ status: 'pending', value: undefined });

        await runSlice(scheduler);
        expect(result.current).toMatchObject({ status: 'success', value: 42, error: undefined });
    });

    it('reports a thrown computation as error state', async () => {
        const { runner, scheduler } = createTestRunner();
        const failure = new Error('boom');
        const { result } = renderHook(
            () =>
                useIdleValue(() => {
                    throw failure;
                }, []),
            { wrapper: withRunner(runner) }
        );

        await runSlice(scheduler);
        expect(result.current).toMatchObject({ status: 'error', error: failure, value: undefined });
    });

    it('goes back to pending on a deps change and ignores the superseded result', async () => {
        const { runner, scheduler } = createTestRunner();
        const { result, rerender } = renderHook(
            ({ id }: { id: number }) => useIdleValue(() => id * 10, [id]),
            { wrapper: withRunner(runner), initialProps: { id: 1 } }
        );

        await runSlice(scheduler);
        expect(result.current.value).toBe(10);

        rerender({ id: 2 });
        expect(result.current).toMatchObject({ status: 'pending', value: undefined });

        await runSlice(scheduler);
        expect(result.current.value).toBe(20);
    });

    it('never commits the previous value under the new deps', async () => {
        const { runner, scheduler } = createTestRunner();
        const committed: string[] = [];
        const { rerender } = renderHook(
            ({ id }: { id: number }) => {
                const state = useIdleValue(() => id * 10, [id]);

                useLayoutEffect(() => {
                    committed.push(`${id}:${state.status}:${String(state.value)}`);
                });

                return state;
            },
            { wrapper: withRunner(runner), initialProps: { id: 1 } }
        );

        await runSlice(scheduler);
        committed.length = 0;
        rerender({ id: 2 });

        expect(committed).not.toContain('2:success:10');
        expect(committed).toContain('2:pending:undefined');
    });

    it('recomputes on refresh without a deps change', async () => {
        const { runner, scheduler } = createTestRunner();
        let counter = 0;
        const { result } = renderHook(() => useIdleValue(() => ++counter, []), {
            wrapper: withRunner(runner),
        });

        await runSlice(scheduler);
        expect(result.current.value).toBe(1);

        act(() => result.current.refresh());
        expect(result.current.status).toBe('pending');

        await runSlice(scheduler);
        expect(result.current.value).toBe(2);
    });

    it('stays idle and computes nothing while disabled', async () => {
        const { runner, scheduler } = createTestRunner();
        const compute = vi.fn(() => 1);
        const { result, rerender } = renderHook(
            ({ enabled }: { enabled: boolean }) => useIdleValue(compute, [], { enabled }),
            { wrapper: withRunner(runner), initialProps: { enabled: false } }
        );

        expect(result.current.status).toBe('idle');
        expect(compute).not.toHaveBeenCalled();

        rerender({ enabled: true });
        await runSlice(scheduler);
        expect(result.current).toMatchObject({ status: 'success', value: 1 });
    });

    it('keeps a stable refresh identity across renders', () => {
        const { runner } = createTestRunner();
        const { result, rerender } = renderHook(() => useIdleValue(() => 1, []), {
            wrapper: withRunner(runner),
        });
        const first = result.current.refresh;

        rerender();
        expect(result.current.refresh).toBe(first);
    });

    it('writes no state after unmount', () => {
        const { runner, scheduler } = createTestRunner();
        const { unmount } = renderHook(() => useIdleValue(() => 1, []), {
            wrapper: withRunner(runner),
        });

        unmount();
        expect(scheduler.pending).toBe(0);
        expect(runner.size).toBe(0);
    });
});
