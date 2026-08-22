import type { ComponentKey } from '../core/Entity';

/** 当前单局及历史分数数据。 */
export interface ScoreComponent {
    score: number;
    highScore: number;
    combo: number;
    totalClearedLines: number;
}

export const ScoreComponentKey = 'game.score' as ComponentKey<ScoreComponent>;
