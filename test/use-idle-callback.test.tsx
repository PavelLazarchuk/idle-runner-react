import { describe, expect, it, vi } from 'vitest';
import { renderHook } from '@testing-library/react';
import { useIdleCallback } from '../src/index';
import { createTestRunner, runSlice, withRunner } from './harness';

describe('useIdleCallback', () => {
    it('queues the call and resolves with its result', async () => {
        const { runner, scheduler } = createTestRunner();
        const spy = vi.fn((left: number, right: number) => left + right);
        const { result } = renderHook(() => useIdleCallback(spy), { wrapper: withRunner(runner) });

        const pending = result.current(2, 3);
        expect(spy).not.toHaveBeenCalled();

        await runSlice(scheduler);
        await expect(pending).resolves.toBe(5);
    });

    it('keeps a stable identity while calling the newest callback', async () => {
        const { runner, scheduler } = createTestRunner();
        const { result, rerender } = renderHook(
            ({ id }: { id: number }) => useIdleCallback(() => id),
            { wrapper: withRunner(runner), initialProps: { id: 1 } }
        );
        const first = result.current;

        rerender({ id: 2 });
        expect(result.current).toBe(first);

        const pending = first();
        await runSlice(scheduler);
        await expect(pending).resolves.toBe(2);
    });

    it('rejects with the callback failure', async () => {
        const { runner, scheduler } = createTestRunner();
        const failure = new Error('boom');
        const { result } = renderHook(
            () =>
                useIdleCallback(() => {
                    throw failure;
                }),
            { wrapper: withRunner(runner) }
        );

        const settled = result.current().then(
            () => 'resolved',
            error => error
        );

        await runSlice(scheduler);
        await expect(settled).resolves.toBe(failure);
    });

    it('lets queued work outlive the component by default', async () => {
        const { runner, scheduler } = createTestRunner();
        const { result, unmount } = renderHook(() => useIdleCallback(() => 'done'), {
            wrapper: withRunner(runner),
        });

        const pending = result.current();
        unmount();
        await runSlice(scheduler);
        await expect(pending).resolves.toBe('done');
    });

    it('aborts in-flight calls on unmount when asked to', async () => {
        const { runner } = createTestRunner();
        const { result, unmount } = renderHook(
            () => useIdleCallback(() => 'done', { abortOnUnmount: true }),
            { wrapper: withRunner(runner) }
        );

        const pending = result.current();
        unmount();
        await expect(pending).rejects.toMatchObject({ name: 'AbortError' });
    });

    it('keeps in-flight calls alive when abortOnUnmount is turned off', async () => {
        const { runner, scheduler } = createTestRunner();
        const { result, rerender } = renderHook(
            ({ abortOnUnmount }: { abortOnUnmount: boolean }) =>
                useIdleCallback(() => 'done', { abortOnUnmount }),
            { wrapper: withRunner(runner), initialProps: { abortOnUnmount: true } }
        );

        const pending = result.current();
        rerender({ abortOnUnmount: false });

        await runSlice(scheduler);
        await expect(pending).resolves.toBe('done');
    });

    it('forwards timeout to the scheduler request', () => {
        const { runner, scheduler } = createTestRunner();
        const { result } = renderHook(() => useIdleCallback(() => 1, { timeout: 500 }), {
            wrapper: withRunner(runner),
        });

        void result.current().catch(() => {});
        expect(scheduler.lastTimeout).toBeGreaterThan(490);
        expect(scheduler.lastTimeout).toBeLessThanOrEqual(500);
    });

    it('forwards priority to the runner, so a user-blocking call jumps a default one', async () => {
        const { runner, scheduler } = createTestRunner();
        const order: string[] = [];
        const { result: vis } = renderHook(() => useIdleCallback(() => order.push('vis')), {
            wrapper: withRunner(runner),
        });
        const { result: urgent } = renderHook(
            () => useIdleCallback(() => order.push('urgent'), { priority: 'user-blocking' }),
            { wrapper: withRunner(runner) }
        );

        void vis.current();
        void urgent.current();
        await runSlice(scheduler);
        expect(order).toEqual(['urgent', 'vis']);
    });

    it('forwards key so calling it again before it runs supersedes the earlier call', async () => {
        const { runner, scheduler } = createTestRunner();
        const { result } = renderHook(
            () => useIdleCallback((label: string) => label, { key: 'call' }),
            { wrapper: withRunner(runner) }
        );

        const first = result.current('first');
        first.catch(() => {});
        const second = result.current('second');

        expect(runner.size).toBe(1);
        await runSlice(scheduler);
        await expect(first).rejects.toMatchObject({ name: 'AbortError' });
        await expect(second).resolves.toBe('second');
    });
});
