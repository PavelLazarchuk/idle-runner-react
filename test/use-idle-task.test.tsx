import { describe, expect, it, vi } from 'vitest';
import { renderHook } from '@testing-library/react';
import { useIdleTask } from '../src/index';
import { createTestRunner, runSlice, withRunner } from './harness';

describe('useIdleTask', () => {
    it('queues the task instead of running it during the commit', async () => {
        const { runner, scheduler } = createTestRunner();
        const task = vi.fn();

        renderHook(() => useIdleTask(task, []), { wrapper: withRunner(runner) });
        expect(task).not.toHaveBeenCalled();

        await runSlice(scheduler);
        expect(task).toHaveBeenCalledTimes(1);
    });

    it('re-runs when deps change and not when other renders happen', async () => {
        const { runner, scheduler } = createTestRunner();
        const task = vi.fn();
        const { rerender } = renderHook(({ id }: { id: number }) => useIdleTask(task, [id]), {
            wrapper: withRunner(runner),
            initialProps: { id: 1 },
        });

        await runSlice(scheduler);
        rerender({ id: 1 });
        expect(scheduler.pending).toBe(0);

        rerender({ id: 2 });
        await runSlice(scheduler);
        expect(task).toHaveBeenCalledTimes(2);
    });

    it('aborts a task that is still queued when deps change, so it never sees stale props', async () => {
        const { runner, scheduler } = createTestRunner();
        const seen: number[] = [];
        const { rerender } = renderHook(
            ({ id }: { id: number }) => useIdleTask(() => seen.push(id), [id]),
            { wrapper: withRunner(runner), initialProps: { id: 1 } }
        );

        rerender({ id: 2 });
        await runSlice(scheduler);
        expect(seen).toEqual([2]);
    });

    it('aborts a queued task on unmount', async () => {
        const { runner, scheduler } = createTestRunner();
        const task = vi.fn();
        const { unmount } = renderHook(() => useIdleTask(task, []), {
            wrapper: withRunner(runner),
        });

        unmount();
        expect(runner.size).toBe(0);
        expect(scheduler.pending).toBe(0);
        expect(task).not.toHaveBeenCalled();
    });

    it('queues nothing while disabled and queues once enabled', async () => {
        const { runner, scheduler } = createTestRunner();
        const task = vi.fn();
        const { rerender } = renderHook(
            ({ enabled }: { enabled: boolean }) => useIdleTask(task, [], { enabled }),
            { wrapper: withRunner(runner), initialProps: { enabled: false } }
        );

        expect(scheduler.pending).toBe(0);

        rerender({ enabled: true });
        await runSlice(scheduler);
        expect(task).toHaveBeenCalledTimes(1);
    });

    it('reports a failing task to onError and an abort to nobody', async () => {
        const { runner, scheduler } = createTestRunner();
        const onError = vi.fn();
        const failure = new Error('boom');
        const { rerender, unmount } = renderHook(
            ({ id }: { id: number }) =>
                useIdleTask(
                    () => {
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

        renderHook(() => useIdleTask(() => {}, [], { timeout: 250 }), {
            wrapper: withRunner(runner),
        });

        expect(scheduler.lastTimeout).toBeGreaterThan(240);
        expect(scheduler.lastTimeout).toBeLessThanOrEqual(250);
    });

    it('uses the newest closure without re-queueing', async () => {
        const { runner, scheduler } = createTestRunner();
        const seen: number[] = [];
        const { rerender } = renderHook(
            // eslint-disable-next-line react-hooks/exhaustive-deps -- the stale closure is the point
            ({ id }: { id: number }) => useIdleTask(() => seen.push(id), []),
            { wrapper: withRunner(runner), initialProps: { id: 1 } }
        );

        rerender({ id: 2 });
        await runSlice(scheduler);
        expect(seen).toEqual([2]);
    });
});
