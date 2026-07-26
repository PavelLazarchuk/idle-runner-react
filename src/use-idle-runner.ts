import { useEffect, useRef, useState } from 'react';
import { IdleRunner, type IdleRunnerOptions } from '@idle-runner/core';

/**
 * A runner owned by the component: destroyed on unmount, so its page-lifecycle
 * listeners and queued tasks go with it. Options are read once, when the instance is
 * created; changing them later has no effect.
 *
 * Reach for `sharedRunner()` (the default for every other hook here) unless you need a
 * queue with its own budget or one you can `clear()` wholesale.
 */
export function useIdleRunner(options?: IdleRunnerOptions): IdleRunner {
    const optionsRef = useRef(options);
    const [runner, setRunner] = useState(() => new IdleRunner(optionsRef.current));
    const destroyedRef = useRef(false);

    useEffect(() => {
        if (destroyedRef.current) {
            destroyedRef.current = false;
            const next = new IdleRunner(optionsRef.current);
            let adopted = false;

            setRunner(() => {
                adopted = true;

                return next;
            });

            return () => {
                if (adopted) return;

                destroyedRef.current = true;
                next.destroy();
            };
        }

        return () => {
            destroyedRef.current = true;
            runner.destroy();
        };
    }, [runner]);

    return runner;
}
