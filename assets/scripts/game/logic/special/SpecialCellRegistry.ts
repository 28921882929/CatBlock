import type { BoardComponent } from '../../ecs/components/BoardComponent';
import type { GameEventQueue } from '../../ecs/core/GameEventQueue';

/** 特殊格支持的标准触发时机。 */
export enum CellTrigger {
    OnPlaced = 'on-placed',
    BeforeClear = 'before-clear',
    OnCleared = 'on-cleared',
    OnNeighborCleared = 'on-neighbor-cleared',
    OnTurnEnded = 'on-turn-ended',
}

/** 特殊效果执行上下文。 */
export interface CellEffectContext {
    readonly board: BoardComponent;
    readonly sourceIndex: number;
    readonly chainDepth: number;
    readonly events: GameEventQueue;
}

/** 数据驱动的特殊格行为定义。 */
export interface SpecialCellDefinition {
    readonly id: string;
    readonly trigger: CellTrigger;
    readonly priority: number;
    resolve(context: CellEffectContext): void;
}

/** 特殊格 ID 与行为的集中注册表。 */
export class SpecialCellRegistry {
    private readonly definitions = new Map<string, SpecialCellDefinition>();

    public register(definition: SpecialCellDefinition): void {
        this.definitions.set(definition.id, definition);
    }

    public get(id: string): SpecialCellDefinition | undefined {
        return this.definitions.get(id);
    }

    public clear(): void {
        this.definitions.clear();
    }
}
