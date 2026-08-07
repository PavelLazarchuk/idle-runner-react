import type { ReactNode } from 'react';

import { useIdleMount, type UseIdleMountOptions } from './use-idle-mount';

export interface DeferProps extends UseIdleMountOptions {
    children?: ReactNode;
    fallback?: ReactNode;
}

/**
 * Renders `children` once the page is idle, and `fallback` until then — the
 * component form of {@link useIdleMount}, for the common case where the deferred
 * thing is a subtree rather than a value.
 *
 * ```tsx
 * <Defer fallback={<ChartSkeleton />} timeout={2000}>
 *     <HeavyChart data={data} />
 * </Defer>
 * ```
 *
 * `children` is an element, so React creates it on every render whether or not it
 * is shown — cheap, since the cost being deferred is mounting and rendering it, not
 * describing it. Where even creating the element is too much, use `useIdleMount`.
 */
export function Defer({ children, fallback = null, ...options }: DeferProps) {
    const ready = useIdleMount(options);

    return <>{ready ? children : fallback}</>;
}
