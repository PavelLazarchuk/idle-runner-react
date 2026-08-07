import { useEffect, useState } from 'react';
import type { IdleRunner, TaskPriority } from '@idle-runner/core';

import { useResolvedRunner } from './context';
import { reportTaskError } from './internal';

export interface UseIdleMountOptions {
    runner?: IdleRunner;
    timeout?: number;
    enabled?: boolean;
    priority?: TaskPriority;
}

/**
 * `false` until the runner reaches an idle slice, then `true` — the switch for
 * rendering something expensive after the page has settled instead of during the
 * commit that everyone is waiting on.
 *
 * ```tsx
 * const ready = useIdleMount({ timeout: 2000 });
 *
 * return ready ? <HeavyChart data={data} /> : <ChartSkeleton />;
 * ```
 *
 * It never flips back: a subtree that has been mounted stays mounted, because
 * unmounting it would throw away exactly the work this hook was deferring. On the
 * server, and on the first client render, it is `false` — so the fallback is what
 * hydrates, and there is no mismatch. Pass `timeout` for a deadline by which the
 * content mounts even if the page never goes idle.
 */
export function useIdleMount(options: UseIdleMountOptions = {}): boolean {
    const { runner: explicitRunner, timeout, enabled = true, priority } = options;
    const runner = useResolvedRunner(explicitRunner);
    const [ready, setReady] = useState(false);

    useEffect(() => {
        if (!enabled || ready) return;

        const controller = new AbortController();

        runner
            .push(() => undefined, { signal: controller.signal, timeout, priority })
            .then(
                () => setReady(true),
                error => reportTaskError(error, undefined)
            );

        return () => controller.abort();
    }, [runner, enabled, ready, timeout, priority]);

    return ready;
}
