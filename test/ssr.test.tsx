import { describe, expect, it, vi } from 'vitest';
import { renderToString } from 'react-dom/server';
import { IdleRunner } from '@idle-runner/core';
import { Defer, IdleRunnerProvider, useIdleTask, useIdleValue } from '../src/index';
import { FakeScheduler } from './fake-scheduler';

describe('SSR', () => {
    it('renders on the server without queueing or running anything', () => {
        const scheduler = new FakeScheduler();
        const runner = new IdleRunner({ scheduler, flushOnHidden: false });
        const task = vi.fn();
        const compute = vi.fn(() => 'computed');

        function Probe() {
            useIdleTask(task, []);
            const { status, value } = useIdleValue(compute, []);

            return <span>{`${status}:${String(value)}`}</span>;
        }

        const html = renderToString(
            <IdleRunnerProvider runner={runner}>
                <Probe />
            </IdleRunnerProvider>
        );

        expect(html).toContain('pending:undefined');
        expect(task).not.toHaveBeenCalled();
        expect(compute).not.toHaveBeenCalled();
        expect(scheduler.pending).toBe(0);
        expect(runner.size).toBe(0);
    });

    it('renders the fallback of a Defer, so the client hydrates the same tree', () => {
        const scheduler = new FakeScheduler();
        const runner = new IdleRunner({ scheduler, flushOnHidden: false });
        const Heavy = vi.fn(() => <span>chart</span>);

        const html = renderToString(
            <IdleRunnerProvider runner={runner}>
                <Defer fallback={<span>skeleton</span>}>
                    <Heavy />
                </Defer>
            </IdleRunnerProvider>
        );

        expect(html).toContain('skeleton');
        expect(html).not.toContain('chart');
        expect(Heavy).not.toHaveBeenCalled();
        expect(runner.size).toBe(0);
    });

    it('falls back to the shared runner on the server without touching host globals', () => {
        function Probe() {
            useIdleTask(() => {}, []);

            return <span>ok</span>;
        }

        expect(renderToString(<Probe />)).toContain('ok');
    });
});
