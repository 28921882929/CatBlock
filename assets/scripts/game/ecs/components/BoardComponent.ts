import type { ComponentKey } from '../core/Entity';
import { BoardConfig } from '../../config/BoardConfig';

/** 多层棋盘数据；不同数组使用相同的一维格子索引。 */
export interface BoardComponent {
    readonly width: number;
    readonly height: number;
    readonly occupied: Uint8Array;
    readonly contentType: Uint16Array;
    readonly terrainType: Uint16Array;
    readonly value: Int16Array;
    readonly flags: Uint32Array;
    readonly effectIds: string[];
}

export const BoardComponentKey = 'game.board' as ComponentKey<BoardComponent>;

/** 创建一张全部为空的棋盘。 */
export function createBoardComponent(width = BoardConfig.width, height = BoardConfig.height): BoardComponent {
    const cellCount = width * height;
    return {
        width,
        height,
        occupied: new Uint8Array(cellCount),
        contentType: new Uint16Array(cellCount),
        terrainType: new Uint16Array(cellCount),
        value: new Int16Array(cellCount),
        flags: new Uint32Array(cellCount),
        effectIds: new Array<string>(cellCount).fill(''),
    };
}
