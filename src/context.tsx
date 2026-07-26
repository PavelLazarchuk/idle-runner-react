import { createContext, useContext, type ReactNode } from 'react';
import { sharedRunner, type IdleRunner } from '@idle-runner/core';

const IdleRunnerContext = createContext<IdleRunner | null>(null);

export interface IdleRunnerProviderProps {
    runner?: IdleRunner;
    children?: ReactNode;
}

export function IdleRunnerProvider({ runner, children }: IdleRunnerProviderProps) {
    const inherited = useContext(IdleRunnerContext);

    return (
        <IdleRunnerContext.Provider value={runner ?? inherited}>
            {children}
        </IdleRunnerContext.Provider>
    );
}

export function useIdleRunnerContext(): IdleRunner {
    return useContext(IdleRunnerContext) ?? sharedRunner();
}

export function useResolvedRunner(runner: IdleRunner | undefined): IdleRunner {
    const fromContext = useContext(IdleRunnerContext);

    return runner ?? fromContext ?? sharedRunner();
}
