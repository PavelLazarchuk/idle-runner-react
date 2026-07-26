import type { ReactNode } from 'react';
import { describe, expect, it, vi } from 'vitest';
import { render, renderHook } from '@testing-library/react';
import { sharedRunner } from '@idle-runner/core';
import { IdleRunnerProvider, useIdleRunnerContext, useIdleTask } from '../src/index';
import { createTestRunner, runSlice, withRunner } from './harness';

describe('IdleRunnerProvider', () => {
    it('falls back to the shared runner with no provider', () => {
        const { result } = renderHook(() => useIdleRunnerContext());

        expect(result.current).toBe(sharedRunner());
    });

    it('hands the provided runner to hooks below it', async () => {
        const { runner, scheduler } = createTestRunner();
        const task = vi.fn();

        renderHook(() => useIdleTask(task, []), { wrapper: withRunner(runner) });
        await runSlice(scheduler);

        expect(task).toHaveBeenCalledTimes(1);
    });

    it('treats a provider without a runner as no provider at all', () => {
        const wrapper = ({ children }: { children: ReactNode }) => (
            <IdleRunnerProvider>{children}</IdleRunnerProvider>
        );
        const { result } = renderHook(() => useIdleRunnerContext(), { wrapper });

        expect(result.current).toBe(sharedRunner());
    });

    it('keeps the outer runner when a nested provider is handed none', () => {
        const outer = createTestRunner();
        const wrapper = ({ children }: { children: ReactNode }) => (
            <IdleRunnerProvider runner={outer.runner}>
                <IdleRunnerProvider>{children}</IdleRunnerProvider>
            </IdleRunnerProvider>
        );
        const { result } = renderHook(() => useIdleRunnerContext(), { wrapper });

        expect(result.current).toBe(outer.runner);
    });

    it('lets a per-hook runner option win over the provider', async () => {
        const provided = createTestRunner();
        const override = createTestRunner();
        const task = vi.fn();

        renderHook(() => useIdleTask(task, [], { runner: override.runner }), {
            wrapper: withRunner(provided.runner),
        });

        expect(provided.scheduler.pending).toBe(0);

        await runSlice(override.scheduler);
        expect(task).toHaveBeenCalledTimes(1);
    });

    it('re-queues on the new runner when the provider swaps one in', async () => {
        const first = createTestRunner();
        const second = createTestRunner();
        const task = vi.fn();

        function Probe() {
            useIdleTask(task, []);

            return null;
        }

        const { rerender } = render(
            <IdleRunnerProvider runner={first.runner}>
                <Probe />
            </IdleRunnerProvider>
        );

        rerender(
            <IdleRunnerProvider runner={second.runner}>
                <Probe />
            </IdleRunnerProvider>
        );

        expect(first.scheduler.pending).toBe(0);

        await runSlice(second.scheduler);
        expect(task).toHaveBeenCalledTimes(1);
    });
});
