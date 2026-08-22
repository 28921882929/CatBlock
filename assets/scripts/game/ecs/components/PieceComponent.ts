import type { PieceCellConfig } from '../../config/PieceConfig';
import type { ComponentKey } from '../core/Entity';

/** 待选区中的一个可放置方块。 */
export interface PieceComponent {
    readonly shapeId: string;
    readonly cells: readonly PieceCellConfig[];
    readonly trayIndex: number;
}

export const PieceComponentKey = 'game.piece' as ComponentKey<PieceComponent>;
