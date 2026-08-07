import { describe, expect, it, vi } from 'vitest';
import { render, renderHook, screen } from '@testing-library/react';
import { Defer, useIdleMount } from '../src/index';
import { createTestRunner, runSlice, withRunner } from './harness';

describe('useIdleMount', () => {
    it('is false before the first slice and true after it', async () => {
        const { runner, scheduler } = createTestRunner();
        const { result } = renderHook(() => useIdleMount(), { wrapper: withRunner(runner) });

        expect(result.current).toBe(false);

        await runSlice(scheduler);
        expect(result.current).toBe(true);
    });

    it('stays true and stops queueing once it has flipped', async () => {
        const { runner, scheduler } = createTestRunner();
        const { result, rerender } = renderHook(() => useIdleMount(), {
            wrapper: withRunner(runner),
        });

        await runSlice(scheduler);
        rerender();

        expect(result.current).toBe(true);
        expect(scheduler.pending).toBe(0);
        expect(runner.size).toBe(0);
    });

    it('queues nothing while disabled, and mounts once enabled', async () => {
        const { runner, scheduler } = createTestRunner();
        const { result, rerender } = renderHook(
            ({ enabled }: { enabled: boolean }) => useIdleMount({ enabled }),
            { wrapper: withRunner(runner), initialProps: { enabled: false } }
        );

        expect(scheduler.pending).toBe(0);
        expect(result.current).toBe(false);

        rerender({ enabled: true });
        await runSlice(scheduler);
        expect(result.current).toBe(true);
    });

    it('forwards timeout, so the content mounts even if the page never idles', async () => {
        const { runner, scheduler } = createTestRunner();
        const { result } = renderHook(() => useIdleMount({ timeout: 250 }), {
            wrapper: withRunner(runner),
        });

        expect(scheduler.lastTimeout).toBeGreaterThan(240);
        expect(scheduler.lastTimeout).toBeLessThanOrEqual(250);

        await runSlice(scheduler);
        expect(result.current).toBe(true);
    });

    it('drops its queued task on unmount', () => {
        const { runner, scheduler } = createTestRunner();
        const { unmount } = renderHook(() => useIdleMount(), { wrapper: withRunner(runner) });

        unmount();

        expect(runner.size).toBe(0);
        expect(scheduler.pending).toBe(0);
    });

    it('a user-blocking mount goes ahead of default work', async () => {
        const { runner, scheduler } = createTestRunner();
        const order: string[] = [];

        renderHook(() => useIdleMount({ priority: 'user-blocking' }), {
            wrapper: withRunner(runner),
        });
        void runner.push(() => order.push('default'));

        await runSlice(scheduler);
        expect(order).toEqual(['default']);
        expect(runner.size).toBe(0);
    });
});

describe('Defer', () => {
    it('renders the fallback first and the children after the slice', async () => {
        const { runner, scheduler } = createTestRunner();
        const Heavy = vi.fn(() => <div>chart</div>);

        render(
            <Defer fallback={<div>skeleton</div>}>
                <Heavy />
            </Defer>,
            { wrapper: withRunner(runner) }
        );

        expect(screen.getByText('skeleton')).toBeTruthy();
        expect(Heavy).not.toHaveBeenCalled();

        await runSlice(scheduler);
        expect(screen.getByText('chart')).toBeTruthy();
        expect(Heavy).toHaveBeenCalled();
    });

    it('renders nothing when no fallback is given', async () => {
        const { runner, scheduler } = createTestRunner();
        const { container } = render(
            <Defer>
                <div>late</div>
            </Defer>,
            { wrapper: withRunner(runner) }
        );

        expect(container.textContent).toBe('');

        await runSlice(scheduler);
        expect(container.textContent).toBe('late');
    });

    it('forwards its options to the runner', () => {
        const { runner, scheduler } = createTestRunner();

        render(<Defer timeout={250}>late</Defer>, { wrapper: withRunner(runner) });

        expect(scheduler.lastTimeout).toBeGreaterThan(240);
        expect(scheduler.lastTimeout).toBeLessThanOrEqual(250);
        expect(runner.size).toBe(1);
    });
});
