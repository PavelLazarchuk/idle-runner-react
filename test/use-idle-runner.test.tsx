import { StrictMode, type ReactNode } from 'react';
import { describe, expect, it } from 'vitest';
import { renderHook } from '@testing-library/react';
import { IdleRunner } from '@idle-runner/core';
import { useIdleRunner } from '../src/index';

const strict = ({ children }: { children: ReactNode }) => <StrictMode>{children}</StrictMode>;

describe('useIdleRunner', () => {
    it('returns one runner across renders', () => {
        const { result, rerender } = renderHook(() => useIdleRunner({ flushOnHidden: false }));
        const first = result.current;

        expect(first).toBeInstanceOf(IdleRunner);
        rerender();
        expect(result.current).toBe(first);
    });

    it('destroys the runner on unmount, rejecting its queued work', async () => {
        const { result, unmount } = renderHook(() => useIdleRunner({ flushOnHidden: false }));
        const pending = result.current.push(() => 'never');

        unmount();
        await expect(pending).rejects.toMatchObject({ name: 'AbortError' });
    });

    it('hands out a live runner after a StrictMode double-mount', async () => {
        const { result } = renderHook(() => useIdleRunner({ flushOnHidden: false }), {
            wrapper: strict,
        });

        await expect(result.current.push(() => 'alive')).resolves.toBe('alive');
    });

    it('passes options through to the runner it creates', async () => {
        const { result } = renderHook(() =>
            useIdleRunner({ flushOnHidden: false, budgetMs: 12, scheduler: undefined })
        );

        await expect(result.current.push(() => 1)).resolves.toBe(1);
    });
});
