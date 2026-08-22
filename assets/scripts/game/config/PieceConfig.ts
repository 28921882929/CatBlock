import { CellContentType, CellFlags, CellTerrainType } from './BoardConfig';

/** 方块中的单个局部格配置。 */
export interface PieceCellConfig {
    readonly row: number;
    readonly column: number;
    readonly contentType: CellContentType;
    readonly terrainType?: CellTerrainType;
    readonly value?: number;
    readonly flags?: CellFlags;
    readonly effectId?: string;
}

/** 一个可生成方块的完整形状配置。 */
export interface PieceShapeConfig {
    readonly id: string;
    readonly cells: readonly PieceCellConfig[];
    readonly weight: number;
    readonly minRound?: number;
}

/** 创建普通格，减少配置表中的重复字段。 */
function cell(row: number, column: number): PieceCellConfig {
    return { row, column, contentType: CellContentType.Normal };
}

/** MVP 方块库。旋转后的形状作为独立配置参与随机。 */
export const PieceConfigs: readonly PieceShapeConfig[] = Object.freeze([
    { id: 'single', weight: 16, cells: [cell(0, 0)] },
    { id: 'line-h-2', weight: 14, cells: [cell(0, 0), cell(0, 1)] },
    { id: 'line-v-2', weight: 14, cells: [cell(0, 0), cell(1, 0)] },
    { id: 'line-h-3', weight: 12, cells: [cell(0, 0), cell(0, 1), cell(0, 2)] },
    { id: 'line-v-3', weight: 12, cells: [cell(0, 0), cell(1, 0), cell(2, 0)] },
    { id: 'line-h-4', weight: 7, cells: [cell(0, 0), cell(0, 1), cell(0, 2), cell(0, 3)] },
    { id: 'line-v-4', weight: 7, cells: [cell(0, 0), cell(1, 0), cell(2, 0), cell(3, 0)] },
    { id: 'line-h-5', weight: 4, minRound: 2, cells: [cell(0, 0), cell(0, 1), cell(0, 2), cell(0, 3), cell(0, 4)] },
    { id: 'line-v-5', weight: 4, minRound: 2, cells: [cell(0, 0), cell(1, 0), cell(2, 0), cell(3, 0), cell(4, 0)] },
    { id: 'square-2', weight: 10, cells: [cell(0, 0), cell(0, 1), cell(1, 0), cell(1, 1)] },
    { id: 'square-3', weight: 3, minRound: 3, cells: [cell(0, 0), cell(0, 1), cell(0, 2), cell(1, 0), cell(1, 1), cell(1, 2), cell(2, 0), cell(2, 1), cell(2, 2)] },
    { id: 'l-small', weight: 10, cells: [cell(0, 0), cell(1, 0), cell(0, 1)] },
    { id: 'l-small-r', weight: 10, cells: [cell(0, 0), cell(0, 1), cell(1, 1)] },
    { id: 't-small', weight: 6, minRound: 2, cells: [cell(0, 0), cell(0, 1), cell(0, 2), cell(1, 1)] },
    { id: 'z-small', weight: 6, minRound: 2, cells: [cell(0, 0), cell(0, 1), cell(1, 1), cell(1, 2)] },
]);
