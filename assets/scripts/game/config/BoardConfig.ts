/** 棋盘固定参数。 */
export const BoardConfig = Object.freeze({
    width: 8,
    height: 8,
});

/** 棋盘内容类型。后续特殊格从 2 开始追加稳定编号。 */
export enum CellContentType {
    Empty = 0,
    Normal = 1,
}

/** 棋盘地形类型，地形不会随普通方块消除而自动移除。 */
export enum CellTerrainType {
    None = 0,
}

/** 可叠加的格子状态位。 */
export enum CellFlags {
    None = 0,
    Locked = 1 << 0,
    Frozen = 1 << 1,
    Indestructible = 1 << 2,
    Triggered = 1 << 3,
}
