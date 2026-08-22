import type { ClearedCellSnapshot, CompletedLines } from '../../logic/BoardRules';
import type { Entity } from '../core/Entity';

/** ECS 内部及外围桥接共用的稳定事件名。 */
export const GameplayEvents = Object.freeze({
    PiecePlaced: 'gameplay:piece-placed',
    PlacementRejected: 'gameplay:placement-rejected',
    LinesDetected: 'gameplay:lines-detected',
    MoveResolved: 'gameplay:move-resolved',
    ScoreChanged: 'gameplay:score-changed',
    TrayRefilled: 'gameplay:tray-refilled',
    SpecialEffectRequested: 'gameplay:special-effect-requested',
    GameOver: 'gameplay:game-over',
});

export interface PiecePlacedEvent {
    readonly sessionEntity: Entity;
    readonly pieceEntity: Entity;
    readonly cellCount: number;
    readonly placedIndices: number[];
}

export interface PlacementRejectedEvent {
    readonly pieceEntity: Entity;
    readonly row: number;
    readonly column: number;
}

export interface LinesDetectedEvent {
    readonly sessionEntity: Entity;
    readonly lines: CompletedLines;
}

export interface MoveResolvedEvent {
    readonly sessionEntity: Entity;
    readonly lineCount: number;
    readonly clearedCells: ClearedCellSnapshot[];
}

export interface ScoreChangedEvent {
    readonly score: number;
    readonly highScore: number;
    readonly combo: number;
}

export interface TrayRefilledEvent {
    readonly round: number;
    readonly pieceEntities: Entity[];
}

export interface GameOverEvent {
    readonly score: number;
    readonly highScore: number;
}
