import { EventBus } from './EventBus';
import { GameEvents, GameState, GameStateChange } from '../game/GameState';
import { Logger } from '../utils/Logger';

const transitions: Readonly<Record<GameState, readonly GameState[]>> = {
    [GameState.Loading]: [GameState.Menu],
    [GameState.Menu]: [GameState.Playing],
    [GameState.Playing]: [GameState.Paused, GameState.GameOver, GameState.Menu],
    [GameState.Paused]: [GameState.Playing, GameState.Menu],
    [GameState.GameOver]: [GameState.Playing, GameState.Menu],
};

export class GameManager {
    private static readonly singleton = new GameManager();
    private state = GameState.Loading;

    public static get instance(): GameManager {
        return this.singleton;
    }

    public get currentState(): GameState {
        return this.state;
    }

    public changeState(next: GameState, force = false): boolean {
        if (next === this.state) return true;
        if (!force && transitions[this.state].indexOf(next) === -1) {
            Logger.warn(`Invalid state transition: ${this.state} -> ${next}`);
            return false;
        }

        const change: GameStateChange = { previous: this.state, current: next };
        this.state = next;
        Logger.log(`State changed: ${change.previous} -> ${change.current}`);
        EventBus.emit(GameEvents.StateChanged, change);
        return true;
    }

    public reset(): void {
        this.state = GameState.Loading;
    }
}
