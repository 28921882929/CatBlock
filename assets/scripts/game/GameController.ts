import { _decorator, Component } from 'cc';
import { EventBus } from '../core/EventBus';
import { GameManager } from '../core/GameManager';
import { GameEvents, GameState } from './GameState';

const { ccclass } = _decorator;

/**
 * 面向场景按钮和玩法系统的游戏流程控制组件。
 * 该组件只表达流程意图，具体状态规则由 `GameManager` 统一判断。
 */
@ccclass('GameController')
export class GameController extends Component {
    /** 从菜单进入正式游戏。 */
    public startGame(): void {
        GameManager.instance.changeState(GameState.Playing);
    }

    /** 暂停正在进行的游戏。 */
    public pauseGame(): void {
        GameManager.instance.changeState(GameState.Paused);
    }

    /** 从暂停状态恢复游戏。 */
    public resumeGame(): void {
        GameManager.instance.changeState(GameState.Playing);
    }

    /** 结束当前对局并进入结算状态。 */
    public endGame(): void {
        GameManager.instance.changeState(GameState.GameOver);
    }

    /** 离开当前对局并返回菜单。 */
    public returnToMenu(): void {
        GameManager.instance.changeState(GameState.Menu);
    }

    /** 重新进入游戏状态，并广播对局重置事件。 */
    public restartGame(): void {
        if (GameManager.instance.changeState(GameState.Playing)) {
            EventBus.emit(GameEvents.Restarted, undefined);
        }
    }
}
