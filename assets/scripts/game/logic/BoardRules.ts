import { CellContentType, CellFlags } from '../config/BoardConfig';
import type { PieceCellConfig, PieceShapeConfig } from '../config/PieceConfig';
import type { BoardComponent } from '../ecs/components/BoardComponent';
import type { PieceComponent } from '../ecs/components/PieceComponent';

/** 完整行列检测结果。 */
export interface CompletedLines {
    readonly rows: number[];
    readonly columns: number[];
    readonly indices: number[];
}

/** 被清除格子的快照，供特殊效果和计分系统读取。 */
export interface ClearedCellSnapshot {
    readonly index: number;
    readonly contentType: number;
    readonly terrainType: number;
    readonly value: number;
    readonly flags: number;
    readonly effectId: string;
}

/** 将行列坐标转换为棋盘一维索引。 */
export function boardIndex(board: BoardComponent, row: number, column: number): number {
    return row * board.width + column;
}

/** 判断方块能否放入指定棋盘原点。 */
export function canPlace(
    board: BoardComponent,
    piece: Pick<PieceComponent, 'cells'>,
    originRow: number,
    originColumn: number,
): boolean {
    for (let index = 0; index < piece.cells.length; index += 1) {
        const cell = piece.cells[index];
        const row = originRow + cell.row;
        const column = originColumn + cell.column;
        if (row < 0 || row >= board.height || column < 0 || column >= board.width) return false;
        if (board.occupied[boardIndex(board, row, column)] !== 0) return false;
    }
    return true;
}

/**
 * 将方块数据写入棋盘。
 * 调用前必须先通过 `canPlace` 验证，返回本次写入的格子索引。
 */
export function placePiece(
    board: BoardComponent,
    piece: Pick<PieceComponent, 'cells'>,
    originRow: number,
    originColumn: number,
): number[] {
    const placedIndices: number[] = [];
    for (let cellIndex = 0; cellIndex < piece.cells.length; cellIndex += 1) {
        const cell: PieceCellConfig = piece.cells[cellIndex];
        const index = boardIndex(board, originRow + cell.row, originColumn + cell.column);
        board.occupied[index] = 1;
        board.contentType[index] = cell.contentType;
        board.terrainType[index] = cell.terrainType ?? board.terrainType[index];
        board.value[index] = cell.value ?? 0;
        board.flags[index] = cell.flags ?? CellFlags.None;
        board.effectIds[index] = cell.effectId ?? '';
        placedIndices.push(index);
    }
    return placedIndices;
}

/** 一次性找出全部完整横行、竖列和需要清除的去重格子。 */
export function findCompletedLines(board: BoardComponent): CompletedLines {
    const rows: number[] = [];
    const columns: number[] = [];
    const marked = new Uint8Array(board.occupied.length);

    for (let row = 0; row < board.height; row += 1) {
        let completed = true;
        for (let column = 0; column < board.width; column += 1) {
            if (board.occupied[boardIndex(board, row, column)] === 0) {
                completed = false;
                break;
            }
        }
        if (!completed) continue;
        rows.push(row);
        for (let column = 0; column < board.width; column += 1) {
            marked[boardIndex(board, row, column)] = 1;
        }
    }

    for (let column = 0; column < board.width; column += 1) {
        let completed = true;
        for (let row = 0; row < board.height; row += 1) {
            if (board.occupied[boardIndex(board, row, column)] === 0) {
                completed = false;
                break;
            }
        }
        if (!completed) continue;
        columns.push(column);
        for (let row = 0; row < board.height; row += 1) {
            marked[boardIndex(board, row, column)] = 1;
        }
    }

    const indices: number[] = [];
    for (let index = 0; index < marked.length; index += 1) {
        if (marked[index] !== 0) indices.push(index);
    }
    return { rows, columns, indices };
}

/** 清除指定索引的内容层，并保留棋盘地形层。 */
export function clearCells(board: BoardComponent, indices: readonly number[]): ClearedCellSnapshot[] {
    const snapshots: ClearedCellSnapshot[] = [];
    for (let position = 0; position < indices.length; position += 1) {
        const index = indices[position];
        if (board.occupied[index] === 0) continue;
        snapshots.push({
            index,
            contentType: board.contentType[index],
            terrainType: board.terrainType[index],
            value: board.value[index],
            flags: board.flags[index],
            effectId: board.effectIds[index],
        });

        // 不可摧毁格保留内容，未来可由特殊效果先移除该标记。
        if ((board.flags[index] & CellFlags.Indestructible) !== 0) continue;
        board.occupied[index] = 0;
        board.contentType[index] = CellContentType.Empty;
        board.value[index] = 0;
        board.flags[index] = CellFlags.None;
        board.effectIds[index] = '';
    }
    return snapshots;
}

/** 判断给定方块集合中是否至少存在一个合法落点。 */
export function hasAvailablePlacement(
    board: BoardComponent,
    pieces: readonly Pick<PieceComponent, 'cells'>[],
): boolean {
    for (let pieceIndex = 0; pieceIndex < pieces.length; pieceIndex += 1) {
        const piece = pieces[pieceIndex];
        for (let row = 0; row < board.height; row += 1) {
            for (let column = 0; column < board.width; column += 1) {
                if (canPlace(board, piece, row, column)) return true;
            }
        }
    }
    return false;
}

/** 把方块配置转换成无实体依赖的可放置数据。 */
export function shapeAsPiece(shape: PieceShapeConfig): Pick<PieceComponent, 'cells'> {
    return { cells: shape.cells };
}
