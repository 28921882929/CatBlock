import { EventBus } from './EventBus';
import { GameEvents, GameState, GameStateChange } from '../game/GameState';
import { Logger } from '../utils/Logger';

/** 每个状态允许进入的下一状态，未列出的切换会被拒绝。 */
const transitions: Readonly<Record<GameState, readonly GameState[]>> = {
    [GameState.Loading]: [GameState.Menu],
    [GameState.Menu]: [GameState.Playing],
    [GameState.Playing]: [GameState.Paused, GameState.GameOver, GameState.Menu],
    [GameState.Paused]: [GameState.Playing, GameState.Menu],
    [GameState.GameOver]: [GameState.Playing, GameState.Menu],
};

/**
 * 游戏主流程状态机。
 *
 * 所有状态切换必须从这里发起，成功后会通过 `EventBus` 广播变化，
 * 使玩法与 UI 可以保持解耦。
 */
export class GameManager {
    private static readonly singleton = new GameManager();
    private state = GameState.Loading;

    public static get instance(): GameManager {
        return this.singleton;
    }

    /** 当前游戏状态的只读访问入口。 */
    public get currentState(): GameState {
        return this.state;
    }

    /**
     * 尝试切换游戏状态。
     * @param next 目标状态。
     * @param force 是否跳过状态迁移规则，默认不跳过。
     * @returns 是否切换成功；目标与当前状态相同时同样返回 `true`。
     */
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

    /** 将状态机恢复到初始加载状态。 */
    public reset(): void {
        this.state = GameState.Loading;
    }
}
