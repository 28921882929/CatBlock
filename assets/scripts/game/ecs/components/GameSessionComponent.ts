import type { ComponentKey } from '../core/Entity';

/** 当前单局运行状态。 */
export interface GameSessionComponent {
    running: boolean;
    moveCount: number;
    roundCount: number;
}

export const GameSessionComponentKey = 'game.session' as ComponentKey<GameSessionComponent>;
