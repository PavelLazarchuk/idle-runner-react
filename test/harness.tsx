import { act } from '@testing-library/react';
import { IdleRunner } from '@idle-runner/core';
import type { ReactNode } from 'react';
import { IdleRunnerProvider } from '../src/index';
import { FakeScheduler } from './fake-scheduler';

export function createTestRunner(): { runner: IdleRunner; scheduler: FakeScheduler } {
    const scheduler = new FakeScheduler();

    return { scheduler, runner: new IdleRunner({ scheduler, flushOnHidden: false }) };
}

export async function runSlice(scheduler: FakeScheduler): Promise<void> {
    await act(async () => {
        scheduler.fireSlice();
    });
}

export function withRunner(runner: IdleRunner) {
    return function Wrapper({ children }: { children: ReactNode }) {
        return <IdleRunnerProvider runner={runner}>{children}</IdleRunnerProvider>;
    };
}
