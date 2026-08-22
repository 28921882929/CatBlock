type EventHandler<T = unknown> = (payload: T) => void;

interface EventListener {
    handler: EventHandler;
    owner?: object;
    once: boolean;
}

export class EventBus {
    private static readonly listeners = new Map<string, Set<EventListener>>();

    public static on<T>(event: string, handler: EventHandler<T>, owner?: object): void {
        this.add(event, handler as EventHandler, owner, false);
    }

    public static once<T>(event: string, handler: EventHandler<T>, owner?: object): void {
        this.add(event, handler as EventHandler, owner, true);
    }

    public static off<T>(event: string, handler?: EventHandler<T>, owner?: object): void {
        const listeners = this.listeners.get(event);
        if (!listeners) return;

        for (const listener of [...listeners]) {
            const matchesHandler = !handler || listener.handler === handler;
            const matchesOwner = !owner || listener.owner === owner;
            if (matchesHandler && matchesOwner) listeners.delete(listener);
        }

        if (listeners.size === 0) this.listeners.delete(event);
    }

    public static emit<T>(event: string, payload: T): void {
        const listeners = this.listeners.get(event);
        if (!listeners) return;

        for (const listener of [...listeners]) {
            listener.handler(payload);
            if (listener.once) listeners.delete(listener);
        }

        if (listeners.size === 0) this.listeners.delete(event);
    }

    public static clearOwner(owner: object): void {
        for (const [event, listeners] of this.listeners) {
            for (const listener of [...listeners]) {
                if (listener.owner === owner) listeners.delete(listener);
            }
            if (listeners.size === 0) this.listeners.delete(event);
        }
    }

    public static clear(): void {
        this.listeners.clear();
    }

    private static add(event: string, handler: EventHandler, owner: object | undefined, once: boolean): void {
        const listeners = this.listeners.get(event) ?? new Set<EventListener>();
        listeners.add({ handler, owner, once });
        this.listeners.set(event, listeners);
    }
}
