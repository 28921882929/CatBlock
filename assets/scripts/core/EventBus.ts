/** 事件回调签名，泛型参数表示事件携带的数据类型。 */
type EventHandler<T = unknown> = (payload: T) => void;

/** 内部监听记录，同时保存一次性标记和可选的生命周期所有者。 */
interface EventListener {
    handler: EventHandler;
    owner?: object;
    once: boolean;
}

/**
 * 轻量级全局事件总线。
 *
 * 组件注册事件时建议传入 `owner`，组件销毁后即可通过 `clearOwner`
 * 一次移除全部关联监听，防止无效回调和内存泄漏。
 */
export class EventBus {
    private static readonly listeners = new Map<string, Set<EventListener>>();

    /** 注册一个持续生效的事件监听。 */
    public static on<T>(event: string, handler: EventHandler<T>, owner?: object): void {
        this.add(event, handler as EventHandler, owner, false);
    }

    /** 注册一个触发一次后自动移除的事件监听。 */
    public static once<T>(event: string, handler: EventHandler<T>, owner?: object): void {
        this.add(event, handler as EventHandler, owner, true);
    }

    /**
     * 移除匹配的事件监听。
     * 未传 `handler` 或 `owner` 时，对应条件视为全部匹配。
     */
    public static off<T>(event: string, handler?: EventHandler<T>, owner?: object): void {
        const listeners = this.listeners.get(event);
        if (!listeners) return;

        // 使用快照允许回调集合在遍历期间安全删除元素。
        const snapshot = Array.from(listeners);
        for (let index = 0; index < snapshot.length; index += 1) {
            const listener = snapshot[index];
            const matchesHandler = !handler || listener.handler === handler;
            const matchesOwner = !owner || listener.owner === owner;
            if (matchesHandler && matchesOwner) listeners.delete(listener);
        }

        if (listeners.size === 0) this.listeners.delete(event);
    }

    /** 向当前事件的全部监听者同步派发数据。 */
    public static emit<T>(event: string, payload: T): void {
        const listeners = this.listeners.get(event);
        if (!listeners) return;

        const snapshot = Array.from(listeners);
        for (let index = 0; index < snapshot.length; index += 1) {
            const listener = snapshot[index];
            listener.handler(payload);
            if (listener.once) listeners.delete(listener);
        }

        if (listeners.size === 0) this.listeners.delete(event);
    }

    /** 移除指定所有者注册的全部事件监听。 */
    public static clearOwner(owner: object): void {
        this.listeners.forEach((listeners, event) => {
            const snapshot = Array.from(listeners);
            for (let index = 0; index < snapshot.length; index += 1) {
                const listener = snapshot[index];
                if (listener.owner === owner) listeners.delete(listener);
            }
            if (listeners.size === 0) this.listeners.delete(event);
        });
    }

    /** 清空整个事件总线，通常只在应用退出或重置时调用。 */
    public static clear(): void {
        this.listeners.clear();
    }

    /** 写入监听记录的统一内部实现。 */
    private static add(event: string, handler: EventHandler, owner: object | undefined, once: boolean): void {
        const listeners = this.listeners.get(event) ?? new Set<EventListener>();
        listeners.add({ handler, owner, once });
        this.listeners.set(event, listeners);
    }
}
