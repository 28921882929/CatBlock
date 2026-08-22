export enum GameState {
    Loading = 'loading',
    Menu = 'menu',
    Playing = 'playing',
    Paused = 'paused',
    GameOver = 'game-over',
}

export interface GameStateChange {
    previous: GameState;
    current: GameState;
}

export const GameEvents = Object.freeze({
    StateChanged: 'game:state-changed',
    Restarted: 'game:restarted',
});
