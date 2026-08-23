import { useEffect } from 'react';
import type { IdleRunner, TaskPriority } from '@idle-runner/core';

import { useResolvedRunner } from './context';
import { isAbortError, useLatest } from './internal';

export type PrefetchAs =
    | 'audio'
    | 'document'
    | 'embed'
    | 'fetch'
    | 'font'
    | 'image'
    | 'object'
    | 'script'
    | 'style'
    | 'track'
    | 'video'
    | 'worker';

export interface UseIdlePrefetchOptions {
    runner?: IdleRunner;
    timeout?: number;
    enabled?: boolean;
    priority?: TaskPriority;
    as?: PrefetchAs;
    crossOrigin?: 'anonymous' | 'use-credentials';
    respectSaveData?: boolean;
    onError?: (error: unknown) => void;
}

interface NetworkInformation {
    saveData?: boolean;
    effectiveType?: string;
}

const requested = new Set<string>();

function normalize(url: string): string {
    try {
        return new URL(url, document.baseURI).href;
    } catch {
        return url;
    }
}

function supportsPrefetchLink(): boolean {
    try {
        return document.createElement('link').relList.supports('prefetch');
    } catch {
        return false;
    }
}

function isSavingData(): boolean {
    const connection = (navigator as Navigator & { connection?: NetworkInformation }).connection;

    if (!connection) return false;

    return connection.saveData === true || (connection.effectiveType ?? '').includes('2g');
}

function fail(href: string, options: UseIdlePrefetchOptions, error: unknown): void {
    requested.delete(href);
    options.onError?.(error);
}

function warm(href: string, options: UseIdlePrefetchOptions): void {
    if (supportsPrefetchLink()) {
        const link = document.createElement('link');
        link.rel = 'prefetch';
        link.href = href;

        if (options.as) link.setAttribute('as', options.as);
        if (options.crossOrigin) link.setAttribute('crossorigin', options.crossOrigin);

        link.addEventListener('error', () => {
            link.remove();
            fail(href, options, new Error(`idle-runner/react: prefetch failed for ${href}`));
        });

        document.head.appendChild(link);

        return;
    }

    const request: RequestInit & { priority?: string } = {
        mode: options.crossOrigin ? 'cors' : 'no-cors',
        credentials: options.crossOrigin === 'use-credentials' ? 'include' : 'same-origin',
        priority: 'low',
    };

    void fetch(href, request)
        .then(response => response.arrayBuffer())
        .then(
            () => undefined,
            error => fail(href, options, error)
        );
}

function toList(url: string | readonly string[] | null | undefined): string[] {
    if (!url) return [];

    return (typeof url === 'string' ? [url] : url).filter(Boolean);
}

/**
 * Warms the cache for URLs the page will probably need next, in an idle slice.
 *
 * ```tsx
 * useIdlePrefetch(nextPage?.href, { as: 'document' });
 * useIdlePrefetch(visibleProducts.map(product => product.imageUrl), { as: 'image' });
 * ```
 *
 * Injects `<link rel="prefetch">` where the browser supports it and falls back to a
 * low-priority `fetch` where it does not — Safari, which has never shipped
 * `rel="prefetch"`. Each URL is warmed once per document however many components ask
 * for it, and a URL still queued when the component unmounts is dropped rather than
 * fetched. Prefetching is skipped entirely on a metered or 2g connection unless
 * `respectSaveData: false` says otherwise: the point of a prefetch is to spend
 * bandwidth that is going spare.
 *
 * Pass `null` or an empty array for "nothing to prefetch yet" — nothing is queued
 * until there is.
 */
export function useIdlePrefetch(
    url: string | readonly string[] | null | undefined,
    options: UseIdlePrefetchOptions = {}
): void {
    const {
        runner: explicitRunner,
        timeout,
        enabled = true,
        priority = 'background',
        onError,
    } = options;
    const runner = useResolvedRunner(explicitRunner);
    const optionsRef = useLatest(options);
    const onErrorRef = useLatest(onError);
    const urls = toList(url);
    const urlsRef = useLatest(urls);
    const urlKey = urls.join('\n');

    useEffect(() => {
        if (!enabled || !urlKey) return;

        const controller = new AbortController();

        runner
            .push(
                () => {
                    const current = optionsRef.current;

                    if (current.respectSaveData !== false && isSavingData()) return;

                    for (const target of urlsRef.current) {
                        const href = normalize(target);

                        if (requested.has(href)) continue;

                        requested.add(href);
                        warm(href, current);
                    }
                },
                { signal: controller.signal, timeout, priority }
            )
            .catch(error => {
                if (isAbortError(error)) return;

                onErrorRef.current?.(error);
            });

        return () => controller.abort();
    }, [runner, enabled, timeout, priority, urlKey, urlsRef, optionsRef, onErrorRef]);
}
