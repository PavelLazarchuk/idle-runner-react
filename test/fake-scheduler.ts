import type { Deadline, SchedulerAdapter } from '@idle-runner/core';

interface FakeRequest {
    id: number;
    callback: (deadline: Deadline) => void;
    timeout: number | undefined;
}

export class FakeScheduler implements SchedulerAdapter {
    lastTimeout: number | undefined;
    private nextId = 1;
    private readonly live = new Map<number, FakeRequest>();

    request(callback: (deadline: Deadline) => void, timeout?: number): number {
        const id = this.nextId++;
        this.lastTimeout = timeout;
        this.live.set(id, { id, callback, timeout });

        return id;
    }

    cancel(handle: number): void {
        this.live.delete(handle);
    }

    get pending(): number {
        return this.live.size;
    }

    fireSlice(remaining = 50): void {
        const request = this.takeOldest();
        request.callback({ didTimeout: false, timeRemaining: () => remaining });
    }

    fireTimeout(): void {
        const request = this.takeOldest();
        request.callback({ didTimeout: true, timeRemaining: () => 0 });
    }

    private takeOldest(): FakeRequest {
        const first = this.live.entries().next();

        if (first.done) throw new Error('FakeScheduler: no live request to fire');

        this.live.delete(first.value[0]);

        return first.value[1];
    }
}
