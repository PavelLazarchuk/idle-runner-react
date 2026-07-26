import { describe, expect, it, vi } from 'vitest';
import { render, renderHook, waitFor } from '@testing-library/react';
import { useIdleCallback, useIdleEffect, useIdleTask, useIdleValue } from '../../src/index';

describe('hooks against the real browser scheduler', () => {
    it('runs a task off the render path', async () => {
        const task = vi.fn();

        renderHook(() => useIdleTask(task, []));
        expect(task).not.toHaveBeenCalled();

        await waitFor(() => expect(task).toHaveBeenCalledTimes(1));
    });

    it('settles a computed value', async () => {
        const { result } = renderHook(() => useIdleValue(() => 6 * 7, []));

        expect(result.current.status).toBe('pending');
        await waitFor(() => expect(result.current.value).toBe(42));
    });

    it('resolves a queued callback', async () => {
        const { result } = renderHook(() => useIdleCallback((n: number) => n * 2));

        await expect(result.current(21)).resolves.toBe(42);
    });

    it('runs an idle effect and its cleanup', async () => {
        const cleanup = vi.fn();
        const effect = vi.fn(() => cleanup);

        function Probe() {
            useIdleEffect(effect, []);

            return <span>probe</span>;
        }

        const { unmount } = render(<Probe />);
        await waitFor(() => expect(effect).toHaveBeenCalledTimes(1));

        unmount();
        expect(cleanup).toHaveBeenCalledTimes(1);
    });

    it('honors a timeout even when the page never goes idle', async () => {
        const task = vi.fn();
        const spin = () => {
            const until = performance.now() + 60;

            while (performance.now() < until) {
                /* keep the main thread busy so idle periods do not happen */
            }
        };
        const interval = setInterval(spin, 0);

        try {
            renderHook(() => useIdleTask(task, [], { timeout: 100 }));
            await waitFor(() => expect(task).toHaveBeenCalledTimes(1), { timeout: 3000 });
        } finally {
            clearInterval(interval);
        }
    });
});
