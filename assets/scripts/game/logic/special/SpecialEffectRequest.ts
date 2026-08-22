import { CellTrigger } from './SpecialCellRegistry';

/** 等待特殊效果系统处理的一次触发请求。 */
export interface SpecialEffectRequest {
    readonly effectId: string;
    readonly sourceIndex: number;
    readonly trigger: CellTrigger;
    readonly priority: number;
    readonly chainDepth: number;
}
