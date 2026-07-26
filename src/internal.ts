import { useEffect, useRef } from 'react';

export function isAbortError(error: unknown): boolean {
    return (error as { name?: unknown } | null)?.name === 'AbortError';
}

export function useLatest<T>(value: T): { readonly current: T } {
    const ref = useRef(value);

    useEffect(() => {
        ref.current = value;
    });

    return ref;
}

export function reportTaskError(
    error: unknown,
    onError: ((error: unknown) => void) | undefined
): void {
    if (isAbortError(error)) return;

    if (onError) {
        onError(error);

        return;
    }

    queueMicrotask(() => {
        throw error;
    });
}
