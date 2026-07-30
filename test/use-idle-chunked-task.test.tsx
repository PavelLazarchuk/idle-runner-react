import { describe, expect, it, vi } from 'vitest';
import { renderHook } from '@testing-library/react';
import { useIdleChunkedTask } from '../src/index';
import { createTestRunner, runSlice, withRunner } from './harness';

describe('useIdleChunkedTask', () => {
    it('queues the generator instead of running it during the commit', async () => {
        const { runner, scheduler } = createTestRunner();
        const step = vi.fn();
        const task = vi.fn(function* () {
            step();
            yield;
            step();
        });

        renderHook(() => useIdleChunkedTask(task, []), { wrapper: withRunner(runner) });
        expect(task).not.toHaveBeenCalled();

        await runSlice(scheduler);
        expect(step).toHaveBeenCalledTimes(2);
    });

    it('re-runs when deps change and not when other renders happen', async () => {
        const { runner, scheduler } = createTestRunner();
        const task = vi.fn(function* () {
            yield;
        });
        const { rerender } = renderHook(
            ({ id }: { id: number }) => useIdleChunkedTask(task, [id]),
            { wrapper: withRunner(runner), initialProps: { id: 1 } }
        );

        await runSlice(scheduler);
        rerender({ id: 1 });
        expect(scheduler.pending).toBe(0);

        rerender({ id: 2 });
        await runSlice(scheduler);
        expect(task).toHaveBeenCalledTimes(2);
    });

    it('aborts a generator that is still queued when deps change, so it never sees stale props', async () => {
        const { runner, scheduler } = createTestRunner();
        const seen: number[] = [];
        const { rerender } = renderHook(
            ({ id }: { id: number }) =>
                useIdleChunkedTask(
                    function* () {
                        seen.push(id);
                        yield;
                    },
                    [id]
                ),
            { wrapper: withRunner(runner), initialProps: { id: 1 } }
        );

        rerender({ id: 2 });
        await runSlice(scheduler);
        expect(seen).toEqual([2]);
    });

    it('aborts a queued generator on unmount', async () => {
        const { runner, scheduler } = createTestRunner();
        const task = vi.fn(function* () {
            yield;
        });
        const { unmount } = renderHook(() => useIdleChunkedTask(task, []), {
            wrapper: withRunner(runner),
        });

        unmount();
        expect(runner.size).toBe(0);
        expect(scheduler.pending).toBe(0);
        expect(task).not.toHaveBeenCalled();
    });

    it('queues nothing while disabled and queues once enabled', async () => {
        const { runner, scheduler } = createTestRunner();
        const task = vi.fn(function* () {
            yield;
        });
        const { rerender } = renderHook(
            ({ enabled }: { enabled: boolean }) => useIdleChunkedTask(task, [], { enabled }),
            { wrapper: withRunner(runner), initialProps: { enabled: false } }
        );

        expect(scheduler.pending).toBe(0);

        rerender({ enabled: true });
        await runSlice(scheduler);
        expect(task).toHaveBeenCalledTimes(1);
    });

    it('reports a failing generator to onError and an abort to nobody', async () => {
        const { runner, scheduler } = createTestRunner();
        const onError = vi.fn();
        const failure = new Error('boom');
        const { rerender, unmount } = renderHook(
            ({ id }: { id: number }) =>
                useIdleChunkedTask(
                    function* () {
                        throw failure;
                    },
                    // eslint-disable-next-line react-hooks/exhaustive-deps -- `id` is the deps change under test
                    [id],
                    { onError }
                ),
            { wrapper: withRunner(runner), initialProps: { id: 1 } }
        );

        await runSlice(scheduler);
        expect(onError).toHaveBeenCalledWith(failure);

        onError.mockClear();
        rerender({ id: 2 });
        unmount();
        expect(onError).not.toHaveBeenCalled();
    });

    it('forwards timeout to the scheduler request', () => {
        const { runner, scheduler } = createTestRunner();

        renderHook(
            () =>
                useIdleChunkedTask(
                    function* () {
                        yield;
                    },
                    [],
                    { timeout: 250 }
                ),
            { wrapper: withRunner(runner) }
        );

        expect(scheduler.lastTimeout).toBeGreaterThan(240);
        expect(scheduler.lastTimeout).toBeLessThanOrEqual(250);
    });

    it('uses the newest closure without re-queueing', async () => {
        const { runner, scheduler } = createTestRunner();
        const seen: number[] = [];
        const { rerender } = renderHook(
            ({ id }: { id: number }) =>
                useIdleChunkedTask(
                    function* () {
                        seen.push(id);
                        yield;
                    },
                    [] // eslint-disable-line react-hooks/exhaustive-deps -- the stale closure is the point
                ),
            { wrapper: withRunner(runner), initialProps: { id: 1 } }
        );

        rerender({ id: 2 });
        await runSlice(scheduler);
        expect(seen).toEqual([2]);
    });

    it('forwards priority to the runner, so a user-blocking generator jumps a default one', async () => {
        const { runner, scheduler } = createTestRunner();
        const order: string[] = [];

        renderHook(
            () =>
                useIdleChunkedTask(function* () {
                    order.push('vis');
                }, []),
            { wrapper: withRunner(runner) }
        );
        renderHook(
            () =>
                useIdleChunkedTask(
                    function* () {
                        order.push('urgent');
                    },
                    [],
                    { priority: 'user-blocking' }
                ),
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
            () =>
                useIdleChunkedTask(
                    function* () {
                        order.push('first');
                    },
                    [],
                    { key: 'shared', onError }
                ),
            { wrapper: withRunner(runner) }
        );
        renderHook(
            () =>
                useIdleChunkedTask(
                    function* () {
                        order.push('second');
                    },
                    [],
                    { key: 'shared' }
                ),
            { wrapper: withRunner(runner) }
        );

        expect(runner.size).toBe(1);
        await runSlice(scheduler);
        expect(order).toEqual(['second']);
        expect(onError).not.toHaveBeenCalled();
    });
});
