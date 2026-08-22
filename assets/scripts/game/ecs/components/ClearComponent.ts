import type { ComponentKey } from '../core/Entity';

/** 一次放置检测出的完整行列。 */
export interface ClearComponent {
    readonly rows: number[];
    readonly columns: number[];
    readonly indices: number[];
}

export const ClearComponentKey = 'game.clear' as ComponentKey<ClearComponent>;
