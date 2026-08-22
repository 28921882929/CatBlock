import { _decorator, Camera, Canvas, Component, game, Layers, Node, profiler, UITransform } from 'cc';
import { AudioManager } from '../core/AudioManager';
import { EventBus } from '../core/EventBus';
import { GameManager } from '../core/GameManager';
import { ResourceManager } from '../core/ResourceManager';
import { UIManager } from '../ui/UIManager';
import { GameState } from '../game/GameState';
import { GameplayModule } from '../game/GameplayModule';
import { GameplayView } from '../game/view/GameplayView';
import { Logger } from '../utils/Logger';
import { GameConfig } from './GameConfig';

const { ccclass } = _decorator;

/**
 * 游戏唯一入口组件，挂载在 `Main.scene` 的 `AppRoot` 节点上。
 *
 * 它负责创建跨场景常驻节点并初始化各核心管理器。具体玩法逻辑不应
 * 放在这里，避免入口随着业务增长而变得臃肿。
 */
@ccclass('App')
export class App extends Component {
    /** 当前有效入口实例，用于阻止切换场景时重复初始化。 */
    private static current: App | null = null;

    /** 初始化持久节点、UI、音频和游戏状态。 */
    protected onLoad(): void {
        if (App.current && App.current !== this) {
            this.node.destroy();
            return;
        }

        App.current = this;
        game.addPersistRootNode(this.node);
        profiler.hideStats();

        const uiRoot = this.createUIRoot();
        this.node.addChild(uiRoot);
        UIManager.instance.initialize(uiRoot);
        AudioManager.instance.initialize(this.node);
        GameManager.instance.reset();
        this.createGameplayView(uiRoot);
        Logger.log(`${GameConfig.gameName} ${GameConfig.version} initialized`);
    }

    /** 所有管理器准备完成后进入菜单状态。 */
    protected start(): void {
        GameManager.instance.changeState(GameState.Menu);
    }

    /** 只在游戏进行时驱动 ECS，暂停和结算状态不会推进逻辑。 */
    protected update(deltaTime: number): void {
        if (GameManager.instance.currentState === GameState.Playing) {
            GameplayModule.instance.update(deltaTime);
        }
    }

    /** 应用根节点销毁时统一释放事件、UI 和资源引用。 */
    protected onDestroy(): void {
        if (App.current !== this) return;
        UIManager.instance.closeAll(true);
        ResourceManager.instance.releaseAll();
        GameplayModule.instance.destroy();
        EventBus.clear();
        GameManager.instance.reset();
        App.current = null;
    }

    /** 创建覆盖屏幕的 UI Canvas 及专用正交相机。 */
    private createUIRoot(): Node {
        const uiRoot = new Node('UIRoot');
        uiRoot.layer = Layers.Enum.UI_2D;
        uiRoot.addComponent(UITransform);

        const cameraNode = new Node('UICamera');
        cameraNode.layer = Layers.Enum.DEFAULT;
        uiRoot.addChild(cameraNode);

        const camera = cameraNode.addComponent(Camera);
        camera.projection = Camera.ProjectionType.ORTHO;
        camera.priority = 1;
        camera.visibility = Layers.Enum.UI_2D;
        camera.clearFlags = Camera.ClearFlag.SOLID_COLOR;

        const canvas = uiRoot.addComponent(Canvas);
        canvas.alignCanvasWithScreen = true;
        canvas.cameraComponent = camera;
        return uiRoot;
    }

    /** 创建无需外部美术资源即可运行的基础玩法表现层。 */
    private createGameplayView(uiRoot: Node): void {
        const gameplayNode = new Node('GameplayView');
        gameplayNode.layer = Layers.Enum.UI_2D;
        uiRoot.addChild(gameplayNode);
        gameplayNode.addComponent(GameplayView);
    }
}
