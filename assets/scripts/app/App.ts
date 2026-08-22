import { _decorator, Camera, Canvas, Component, game, Layers, Node, UITransform } from 'cc';
import { AudioManager } from '../core/AudioManager';
import { EventBus } from '../core/EventBus';
import { GameManager } from '../core/GameManager';
import { ResourceManager } from '../core/ResourceManager';
import { UIManager } from '../ui/UIManager';
import { GameState } from '../game/GameState';
import { Logger } from '../utils/Logger';
import { GameConfig } from './GameConfig';

const { ccclass } = _decorator;

@ccclass('App')
export class App extends Component {
    private static current: App | null = null;

    protected onLoad(): void {
        if (App.current && App.current !== this) {
            this.node.destroy();
            return;
        }

        App.current = this;
        game.addPersistRootNode(this.node);

        const uiRoot = this.createUIRoot();
        this.node.addChild(uiRoot);
        UIManager.instance.initialize(uiRoot);
        AudioManager.instance.initialize(this.node);
        GameManager.instance.reset();
        Logger.log(`${GameConfig.gameName} ${GameConfig.version} initialized`);
    }

    protected start(): void {
        GameManager.instance.changeState(GameState.Menu);
    }

    protected onDestroy(): void {
        if (App.current !== this) return;
        UIManager.instance.closeAll(true);
        ResourceManager.instance.releaseAll();
        EventBus.clear();
        GameManager.instance.reset();
        App.current = null;
    }

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
}
