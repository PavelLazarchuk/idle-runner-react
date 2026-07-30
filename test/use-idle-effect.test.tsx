import { describe, expect, it, vi } from 'vitest';
import { renderHook } from '@testing-library/react';
import { useIdleEffect } from '../src/index';
import { createTestRunner, runSlice, withRunner } from './harness';

describe('useIdleEffect', () => {
    it('runs the effect on an idle slice and its cleanup on unmount', async () => {
        const { runner, scheduler } = createTestRunner();
        const cleanup = vi.fn();
        const effect = vi.fn(() => cleanup);
        const { unmount } = renderHook(() => useIdleEffect(effect, []), {
            wrapper: withRunner(runner),
        });

        expect(effect).not.toHaveBeenCalled();

        await runSlice(scheduler);
        expect(effect).toHaveBeenCalledTimes(1);
        expect(cleanup).not.toHaveBeenCalled();

        unmount();
        expect(cleanup).toHaveBeenCalledTimes(1);
    });

    it('aborts an effect that never ran instead of cleaning it up', () => {
        const { runner, scheduler } = createTestRunner();
        const cleanup = vi.fn();
        const effect = vi.fn(() => cleanup);
        const { unmount } = renderHook(() => useIdleEffect(effect, []), {
            wrapper: withRunner(runner),
        });

        unmount();
        expect(effect).not.toHaveBeenCalled();
        expect(cleanup).not.toHaveBeenCalled();
        expect(scheduler.pending).toBe(0);
    });

    it('cleans up before re-running on a deps change', async () => {
        const { runner, scheduler } = createTestRunner();
        const order: string[] = [];
        const { rerender } = renderHook(
            ({ id }: { id: number }) =>
                useIdleEffect(() => {
                    order.push(`run:${id}`);

                    return () => order.push(`cleanup:${id}`);
                }, [id]),
            { wrapper: withRunner(runner), initialProps: { id: 1 } }
        );

        await runSlice(scheduler);
        rerender({ id: 2 });
        await runSlice(scheduler);

        expect(order).toEqual(['run:1', 'cleanup:1', 'run:2']);
    });

    it('reports a failing effect to onError', async () => {
        const { runner, scheduler } = createTestRunner();
        const onError = vi.fn();
        const failure = new Error('boom');
        renderHook(
            () =>
                useIdleEffect(
                    () => {
                        throw failure;
                    },
                    [],
                    { onError }
                ),
            { wrapper: withRunner(runner) }
        );

        await runSlice(scheduler);
        expect(onError).toHaveBeenCalledWith(failure);
    });

    it('queues nothing while disabled', () => {
        const { runner, scheduler } = createTestRunner();
        renderHook(() => useIdleEffect(() => {}, [], { enabled: false }), {
            wrapper: withRunner(runner),
        });

        expect(scheduler.pending).toBe(0);
    });

    it('forwards priority to the runner, so a user-blocking effect jumps a default one', async () => {
        const { runner, scheduler } = createTestRunner();
        const order: string[] = [];

        renderHook(() => useIdleEffect(() => void order.push('vis'), []), {
            wrapper: withRunner(runner),
        });
        renderHook(
            () => useIdleEffect(() => void order.push('urgent'), [], { priority: 'user-blocking' }),
            { wrapper: withRunner(runner) }
        );

        await runSlice(scheduler);
        expect(order).toEqual(['urgent', 'vis']);
    });

    it('forwards key so a later push supersedes an earlier pending one with the same key', async () => {
        const { runner, scheduler } = createTestRunner();
        const onError = vi.fn();
        const order: string[] = [];

        renderHook(
            () => useIdleEffect(() => void order.push('first'), [], { key: 'shared', onError }),
            { wrapper: withRunner(runner) }
        );
        renderHook(() => useIdleEffect(() => void order.push('second'), [], { key: 'shared' }), {
            wrapper: withRunner(runner),
        });

        expect(runner.size).toBe(1);
        await runSlice(scheduler);
        expect(order).toEqual(['second']);
        expect(onError).not.toHaveBeenCalled();
    });
});
