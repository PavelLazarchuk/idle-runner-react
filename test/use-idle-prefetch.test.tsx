import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { renderHook } from '@testing-library/react';
import { useIdlePrefetch } from '../src/index';
import { createTestRunner, runSlice, withRunner } from './harness';

function links(): HTMLLinkElement[] {
    return [...document.head.querySelectorAll<HTMLLinkElement>('link[rel="prefetch"]')];
}

function hrefs(): string[] {
    return links().map(link => new URL(link.href).pathname);
}

function setRelListSupport(supported: boolean): void {
    vi.spyOn(HTMLLinkElement.prototype, 'relList', 'get').mockReturnValue({
        supports: () => supported,
    } as unknown as DOMTokenList);
}

beforeEach(() => {
    for (const link of links()) link.remove();
});

afterEach(() => {
    vi.restoreAllMocks();
});

describe('useIdlePrefetch', () => {
    it('injects nothing until the runner reaches a slice, then one link per url', async () => {
        setRelListSupport(true);
        const { runner, scheduler } = createTestRunner();

        renderHook(() => useIdlePrefetch(['/a', '/b']), { wrapper: withRunner(runner) });

        expect(hrefs()).toEqual([]);

        await runSlice(scheduler);

        expect(hrefs()).toEqual(['/a', '/b']);
    });

    it('forwards as and crossOrigin to the link', async () => {
        setRelListSupport(true);
        const { runner, scheduler } = createTestRunner();

        renderHook(() => useIdlePrefetch('/font.woff2', { as: 'font', crossOrigin: 'anonymous' }), {
            wrapper: withRunner(runner),
        });
        await runSlice(scheduler);

        const link = links()[0]!;

        expect(link.getAttribute('as')).toBe('font');
        expect(link.getAttribute('crossorigin')).toBe('anonymous');
    });

    it('warms a url once per document however many components ask', async () => {
        setRelListSupport(true);
        const { runner, scheduler } = createTestRunner();

        renderHook(() => useIdlePrefetch('/deduped'), { wrapper: withRunner(runner) });
        renderHook(() => useIdlePrefetch('/deduped'), { wrapper: withRunner(runner) });

        expect(runner.size).toBe(2);

        await runSlice(scheduler);

        expect(runner.size).toBe(0);
        expect(hrefs()).toEqual(['/deduped']);
    });

    it('queues nothing for an empty, null or disabled url', () => {
        setRelListSupport(true);
        const { runner, scheduler } = createTestRunner();

        renderHook(() => useIdlePrefetch(null), { wrapper: withRunner(runner) });
        renderHook(() => useIdlePrefetch([]), { wrapper: withRunner(runner) });
        renderHook(() => useIdlePrefetch('/off', { enabled: false }), {
            wrapper: withRunner(runner),
        });

        expect(runner.size).toBe(0);
        expect(scheduler.pending).toBe(0);
    });

    it('drops a queued prefetch on unmount', async () => {
        setRelListSupport(true);
        const { runner, scheduler } = createTestRunner();

        const { unmount } = renderHook(() => useIdlePrefetch('/unmounted'), {
            wrapper: withRunner(runner),
        });
        unmount();

        expect(runner.size).toBe(0);
        expect(scheduler.pending).toBe(0);
        expect(hrefs()).toEqual([]);
    });

    it('re-queues when the url list changes', async () => {
        setRelListSupport(true);
        const { runner, scheduler } = createTestRunner();

        const { rerender } = renderHook(({ url }: { url: string }) => useIdlePrefetch(url), {
            wrapper: withRunner(runner),
            initialProps: { url: '/first' },
        });

        await runSlice(scheduler);
        rerender({ url: '/second' });
        await runSlice(scheduler);

        expect(hrefs()).toEqual(['/first', '/second']);
    });

    it('falls back to a low-priority fetch where rel=prefetch is unsupported', async () => {
        setRelListSupport(false);
        const { runner, scheduler } = createTestRunner();
        const fetchMock = vi
            .fn<typeof fetch>()
            .mockResolvedValue({ arrayBuffer: async () => new ArrayBuffer(0) } as Response);
        vi.stubGlobal('fetch', fetchMock);

        renderHook(() => useIdlePrefetch('/safari'), { wrapper: withRunner(runner) });
        await runSlice(scheduler);

        expect(hrefs()).toEqual([]);
        expect(fetchMock).toHaveBeenCalledTimes(1);

        const [url, init] = fetchMock.mock.calls[0]!;

        expect(new URL(url as string).pathname).toBe('/safari');
        expect((init as RequestInit & { priority?: string }).priority).toBe('low');

        vi.unstubAllGlobals();
    });

    it('skips prefetching on a save-data connection', async () => {
        setRelListSupport(true);
        const { runner, scheduler } = createTestRunner();
        Object.defineProperty(navigator, 'connection', {
            configurable: true,
            value: { saveData: true },
        });

        try {
            renderHook(() => useIdlePrefetch('/metered'), { wrapper: withRunner(runner) });
            await runSlice(scheduler);

            expect(hrefs()).toEqual([]);
        } finally {
            Reflect.deleteProperty(navigator, 'connection');
        }
    });

    it('prefetches on a save-data connection when respectSaveData is false', async () => {
        setRelListSupport(true);
        const { runner, scheduler } = createTestRunner();
        Object.defineProperty(navigator, 'connection', {
            configurable: true,
            value: { effectiveType: 'slow-2g' },
        });

        try {
            renderHook(() => useIdlePrefetch('/forced', { respectSaveData: false }), {
                wrapper: withRunner(runner),
            });
            await runSlice(scheduler);

            expect(hrefs()).toEqual(['/forced']);
        } finally {
            Reflect.deleteProperty(navigator, 'connection');
        }
    });

    it('lets a url that failed be tried again by a later mount', async () => {
        setRelListSupport(false);
        const { runner, scheduler } = createTestRunner();
        const fetchMock = vi
            .fn<typeof fetch>()
            .mockRejectedValueOnce(new Error('offline'))
            .mockResolvedValueOnce({ arrayBuffer: async () => new ArrayBuffer(0) } as Response);
        vi.stubGlobal('fetch', fetchMock);

        const first = renderHook(() => useIdlePrefetch('/retried'), {
            wrapper: withRunner(runner),
        });
        await runSlice(scheduler);
        await new Promise(resolve => setTimeout(resolve, 0));
        first.unmount();

        renderHook(() => useIdlePrefetch('/retried'), { wrapper: withRunner(runner) });
        await runSlice(scheduler);

        expect(fetchMock).toHaveBeenCalledTimes(2);

        vi.unstubAllGlobals();
    });

    it('reports a failed link to onError and lets a later mount try again', async () => {
        setRelListSupport(true);
        const { runner, scheduler } = createTestRunner();
        const onError = vi.fn();

        const first = renderHook(() => useIdlePrefetch('/gone', { onError }), {
            wrapper: withRunner(runner),
        });
        await runSlice(scheduler);

        links()[0]!.dispatchEvent(new Event('error'));

        expect(onError).toHaveBeenCalledTimes(1);
        expect(hrefs()).toEqual([]);

        first.unmount();
        renderHook(() => useIdlePrefetch('/gone', { onError }), { wrapper: withRunner(runner) });
        await runSlice(scheduler);

        expect(hrefs()).toEqual(['/gone']);
    });

    it('warms a cross-origin url with a no-cors fallback fetch', async () => {
        setRelListSupport(false);
        const { runner, scheduler } = createTestRunner();
        const fetchMock = vi
            .fn<typeof fetch>()
            .mockResolvedValue({ arrayBuffer: async () => new ArrayBuffer(0) } as Response);
        vi.stubGlobal('fetch', fetchMock);

        renderHook(() => useIdlePrefetch('https://cdn.example.com/chunk.js', { as: 'script' }), {
            wrapper: withRunner(runner),
        });
        await runSlice(scheduler);

        expect(fetchMock.mock.calls[0]![1]).toMatchObject({
            mode: 'no-cors',
            credentials: 'same-origin',
        });

        vi.unstubAllGlobals();
    });

    it('sends a credentialed cors fallback fetch when crossOrigin says so', async () => {
        setRelListSupport(false);
        const { runner, scheduler } = createTestRunner();
        const fetchMock = vi
            .fn<typeof fetch>()
            .mockResolvedValue({ arrayBuffer: async () => new ArrayBuffer(0) } as Response);
        vi.stubGlobal('fetch', fetchMock);

        renderHook(
            () =>
                useIdlePrefetch('https://cdn.example.com/me.json', {
                    as: 'fetch',
                    crossOrigin: 'use-credentials',
                }),
            { wrapper: withRunner(runner) }
        );
        await runSlice(scheduler);

        expect(fetchMock.mock.calls[0]![1]).toMatchObject({
            mode: 'cors',
            credentials: 'include',
        });

        vi.unstubAllGlobals();
    });

    it('reports a failed fallback fetch to onError and nowhere else', async () => {
        setRelListSupport(false);
        const { runner, scheduler } = createTestRunner();
        const failure = new Error('offline');
        vi.stubGlobal('fetch', vi.fn<typeof fetch>().mockRejectedValue(failure));
        const onError = vi.fn();

        renderHook(() => useIdlePrefetch('/broken', { onError }), { wrapper: withRunner(runner) });
        await runSlice(scheduler);
        await new Promise(resolve => setTimeout(resolve, 0));

        expect(onError).toHaveBeenCalledWith(failure);

        vi.unstubAllGlobals();
    });
});
