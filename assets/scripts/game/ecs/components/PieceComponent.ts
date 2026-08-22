import type { PieceCellConfig } from '../../config/PieceConfig';
import type { ComponentKey } from '../core/Entity';

/** 待选区中的一个可放置方块。 */
export interface PieceComponent {
    readonly shapeId: string;
    readonly cells: readonly PieceCellConfig[];
    readonly trayIndex: number;
    /** 同一方块全部组成格共用的表现皮肤索引。 */
    readonly visualStyle: number;
}

export const PieceComponentKey = 'game.piece' as ComponentKey<PieceComponent>;
