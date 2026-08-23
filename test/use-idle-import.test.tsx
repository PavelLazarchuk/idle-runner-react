import { describe, expect, it, vi } from 'vitest';
import { act, renderHook } from '@testing-library/react';
import { useIdleImport } from '../src/index';
import { createTestRunner, runSlice, withRunner } from './harness';

interface Module {
    default: string;
}

function deferredModule(): {
    load: () => Promise<Module>;
    resolve: (module: Module) => void;
} {
    let settle: ((module: Module) => void) | null = null;
    const load = vi.fn(
        () =>
            new Promise<Module>(resolve => {
                settle = resolve;
            })
    );

    return { load, resolve: module => settle?.(module) };
}

describe('useIdleImport', () => {
    it('does not call the loader until the runner reaches a slice', async () => {
        const { runner, scheduler } = createTestRunner();
        const load = vi.fn(async () => ({ default: 'editor' }));

        const { result } = renderHook(() => useIdleImport(load), { wrapper: withRunner(runner) });

        expect(load).not.toHaveBeenCalled();
        expect(result.current.status).toBe('pending');

        await runSlice(scheduler);

        expect(load).toHaveBeenCalledTimes(1);
        expect(result.current.status).toBe('success');
        expect(result.current.value).toEqual({ default: 'editor' });
    });

    it('stays pending while the chunk is in flight and the queue is already empty', async () => {
        const { runner, scheduler } = createTestRunner();
        const deferred = deferredModule();

        const { result } = renderHook(() => useIdleImport(deferred.load), {
            wrapper: withRunner(runner),
        });

        await runSlice(scheduler);

        expect(runner.size).toBe(0);
        expect(result.current.status).toBe('pending');

        await act(async () => {
            deferred.resolve({ default: 'editor' });
        });

        expect(result.current.status).toBe('success');
        expect(result.current.value).toEqual({ default: 'editor' });
    });

    it('reports a failed chunk as an error and retries on refresh', async () => {
        const { runner, scheduler } = createTestRunner();
        const failure = new Error('Loading chunk 7 failed');
        const load = vi
            .fn<() => Promise<Module>>()
            .mockRejectedValueOnce(failure)
            .mockResolvedValueOnce({ default: 'editor' });

        const { result } = renderHook(() => useIdleImport(load), { wrapper: withRunner(runner) });

        await runSlice(scheduler);

        expect(result.current.status).toBe('error');
        expect(result.current.error).toBe(failure);

        await act(async () => {
            result.current.refresh();
        });
        await runSlice(scheduler);

        expect(result.current.status).toBe('success');
        expect(result.current.value).toEqual({ default: 'editor' });
    });

    it('imports once across rerenders, even with a new inline loader each time', async () => {
        const { runner, scheduler } = createTestRunner();
        let calls = 0;
        const { rerender } = renderHook(
            () =>
                useIdleImport(async () => {
                    calls++;

                    return { default: 'editor' };
                }),
            { wrapper: withRunner(runner) }
        );

        await runSlice(scheduler);
        rerender();
        rerender();

        expect(calls).toBe(1);
        expect(scheduler.pending).toBe(0);
    });

    it('queues nothing while disabled, and imports once enabled', async () => {
        const { runner, scheduler } = createTestRunner();
        const load = vi.fn(async () => ({ default: 'editor' }));

        const { result, rerender } = renderHook(
            ({ enabled }: { enabled: boolean }) => useIdleImport(load, { enabled }),
            { wrapper: withRunner(runner), initialProps: { enabled: false } }
        );

        expect(scheduler.pending).toBe(0);
        expect(result.current.status).toBe('idle');

        rerender({ enabled: true });
        await runSlice(scheduler);

        expect(load).toHaveBeenCalledTimes(1);
        expect(result.current.status).toBe('success');
    });

    it('drops a queued import on unmount', () => {
        const { runner, scheduler } = createTestRunner();
        const load = vi.fn(async () => ({ default: 'editor' }));

        const { unmount } = renderHook(() => useIdleImport(load), { wrapper: withRunner(runner) });
        unmount();

        expect(load).not.toHaveBeenCalled();
        expect(runner.size).toBe(0);
        expect(scheduler.pending).toBe(0);
    });

    it('never writes the module to state after unmount', async () => {
        const { runner, scheduler } = createTestRunner();
        const deferred = deferredModule();
        const { result, unmount } = renderHook(() => useIdleImport(deferred.load), {
            wrapper: withRunner(runner),
        });

        await runSlice(scheduler);
        unmount();

        await act(async () => {
            deferred.resolve({ default: 'editor' });
        });

        expect(result.current.status).toBe('pending');
    });

    it('forwards timeout and priority to the runner', async () => {
        const { runner, scheduler } = createTestRunner();
        const order: string[] = [];

        renderHook(
            () =>
                useIdleImport(
                    async () => {
                        order.push('import');

                        return { default: 'editor' };
                    },
                    { timeout: 250, priority: 'user-blocking' }
                ),
            { wrapper: withRunner(runner) }
        );
        void runner.push(() => order.push('default'));

        expect(scheduler.lastTimeout).toBeGreaterThan(240);
        expect(scheduler.lastTimeout).toBeLessThanOrEqual(250);

        await runSlice(scheduler);
        expect(order).toEqual(['import', 'default']);
    });
});
