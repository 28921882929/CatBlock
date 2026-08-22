import { _decorator, Component } from 'cc';
import { EventBus } from '../core/EventBus';
import { GameManager } from '../core/GameManager';
import { GameEvents, GameState } from './GameState';

const { ccclass } = _decorator;

@ccclass('GameController')
export class GameController extends Component {
    public startGame(): void {
        GameManager.instance.changeState(GameState.Playing);
    }

    public pauseGame(): void {
        GameManager.instance.changeState(GameState.Paused);
    }

    public resumeGame(): void {
        GameManager.instance.changeState(GameState.Playing);
    }

    public endGame(): void {
        GameManager.instance.changeState(GameState.GameOver);
    }

    public returnToMenu(): void {
        GameManager.instance.changeState(GameState.Menu);
    }

    public restartGame(): void {
        if (GameManager.instance.changeState(GameState.Playing)) {
            EventBus.emit(GameEvents.Restarted, undefined);
        }
    }
}
