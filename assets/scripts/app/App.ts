import {
    _decorator,
    Camera,
    Canvas,
    Color,
    Component,
    game,
    instantiate,
    Layers,
    Node,
    Prefab,
    profiler,
    SpriteFrame,
    UITransform,
} from 'cc';
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

const { ccclass, property } = _decorator;

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

    /** 猫爪棋盘装饰图，由主场景持有以确保构建时收集依赖。 */
    @property(SpriteFrame)
    public boardFrame: SpriteFrame | null = null;

    /** 可染色闭合纸箱，普通格与待选块共用同一基础资源。 */
    @property(SpriteFrame)
    public closedBoxFrame: SpriteFrame | null = null;

    /** 猫咪探出时使用的开箱前景层。 */
    @property(SpriteFrame)
    public openBoxFrame: SpriteFrame | null = null;

    /** 猫咪头部资源，按方块表现样式稳定轮换。 */
    @property([SpriteFrame])
    public catFrames: SpriteFrame[] = [];

    /** 特殊效果贴纸，顺序由 GameplayView 的效果映射统一解释。 */
    @property([SpriteFrame])
    public effectIconFrames: SpriteFrame[] = [];

    /** 玩法主界面预制件，层级、尺寸、底色和字号均可在编辑器中直接调整。 */
    @property(Prefab)
    public gameplayViewPrefab: Prefab | null = null;

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
        camera.clearColor = new Color(255, 247, 234, 255);

        const canvas = uiRoot.addComponent(Canvas);
        canvas.alignCanvasWithScreen = true;
        canvas.cameraComponent = camera;
        return uiRoot;
    }

    /** 创建玩法表现层，并注入由场景持有的棋盘资源。 */
    private createGameplayView(uiRoot: Node): void {
        if (!this.gameplayViewPrefab) {
            Logger.error('主场景未配置 GameplayView 预制件，已跳过玩法界面创建');
            return;
        }
        const gameplayNode = instantiate(this.gameplayViewPrefab);
        uiRoot.addChild(gameplayNode);
        // 预制件保持为纯 UI 层级，挂入 Canvas 后再添加逻辑组件，
        // 避免自定义组件在反序列化阶段初始化失败，影响整个预制件实例化。
        const gameplayView = gameplayNode.addComponent(GameplayView);
        gameplayView.configureAssets({
            board: this.boardFrame,
            closedBox: this.closedBoxFrame,
            openBox: this.openBoxFrame,
            cats: this.catFrames,
            effectIcons: this.effectIconFrames,
        });
    }
}
