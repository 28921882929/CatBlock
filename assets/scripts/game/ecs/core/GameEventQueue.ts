/** ECS 内部事件记录。 */
interface QueuedEvent<T = unknown> {
    type: string;
    payload: T;
}

/**
 * 单帧游戏事件队列。
 * 系统可以重复读取事件，下一帧开始前由 World 统一清空。
 */
export class GameEventQueue {
    private readonly events: QueuedEvent[] = [];

    /** 发布一个只在当前帧有效的事件。 */
    public emit<T>(type: string, payload: T): void {
        this.events.push({ type, payload });
    }

    /** 返回指定类型事件的数据快照。 */
    public read<T>(type: string): T[] {
        const result: T[] = [];
        for (let index = 0; index < this.events.length; index += 1) {
            const event = this.events[index];
            if (event.type === type) result.push(event.payload as T);
        }
        return result;
    }

    /** 清空上一个逻辑帧遗留的事件。 */
    public clear(): void {
        this.events.length = 0;
    }
}
