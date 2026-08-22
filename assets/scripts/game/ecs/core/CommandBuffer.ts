import type { World } from './World';

/** 延迟到系统阶段结束后执行的结构变更。 */
type WorldCommand = (world: World) => void;

/**
 * ECS 结构变更缓冲区。
 * 系统遍历期间通过它延迟创建、删除实体，防止查询结果被中途修改。
 */
export class CommandBuffer {
    private commands: WorldCommand[] = [];

    /** 追加一条延迟命令。 */
    public enqueue(command: WorldCommand): void {
        this.commands.push(command);
    }

    /** 按写入顺序执行全部命令。 */
    public flush(world: World): void {
        const pending = this.commands;
        this.commands = [];
        for (let index = 0; index < pending.length; index += 1) {
            pending[index](world);
        }
    }

    /** 丢弃尚未执行的命令。 */
    public clear(): void {
        this.commands.length = 0;
    }
}
