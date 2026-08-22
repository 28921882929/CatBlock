/** 游戏主流程状态。 */
export enum GameState {
    Loading = 'loading',
    Menu = 'menu',
    Playing = 'playing',
    Paused = 'paused',
    GameOver = 'game-over',
}

/** 状态切换事件携带的上下文。 */
export interface GameStateChange {
    previous: GameState;
    current: GameState;
}

/** 全局游戏事件名，集中定义以避免散落的字符串常量。 */
export const GameEvents = Object.freeze({
    StateChanged: 'game:state-changed',
    Restarted: 'game:restarted',
});
