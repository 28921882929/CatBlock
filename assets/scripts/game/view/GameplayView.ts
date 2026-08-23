import {
    _decorator,
    Color,
    Component,
    EventMouse,
    EventTouch,
    Label,
    Layers,
    Node,
    Sprite,
    SpriteFrame,
    Texture2D,
    Tween,
    UIOpacity,
    UITransform,
    Vec3,
    view,
    tween,
} from 'cc';
import { EventBus } from '../../core/EventBus';
import { GameManager } from '../../core/GameManager';
import { Logger } from '../../utils/Logger';
import { BoardConfig } from '../config/BoardConfig';
import type { PieceComponent } from '../ecs/components/PieceComponent';
import type { Entity } from '../ecs/core/Entity';
import {
    GameplayEvents,
    type MoveResolvedEvent,
    type PiecePlacedEvent,
    type PlacementRejectedEvent,
    type ScoreChangedEvent,
} from '../ecs/events/GameplayEvents';
import { GameplayModule } from '../GameplayModule';
import { GameEvents, GameState, type GameStateChange } from '../GameState';
import { canPlace } from '../logic/BoardRules';

const { ccclass } = _decorator;

/** 预制件使用固定设计尺寸；运行时只整体等比缩放，避免局部尺寸漂移。 */
const DESIGN_WIDTH = 360;
const DESIGN_HEIGHT = 720;
const BOARD_CELL_SIZE = 40;
const BOARD_LEFT = -160;
const BOARD_TOP = 198;
const TRAY_CELL_SIZE = 31;
const TRAY_SLOT_WIDTH = 104;
const TRAY_SLOT_HEIGHT = 100;
const TRAY_SLOT_Y = -218;
const TRAY_SLOT_STEP = 116;

interface TrayPieceBounds {
    readonly entity: Entity;
    readonly left: number;
    readonly right: number;
    readonly bottom: number;
    readonly top: number;
}

type PointerSource = 'touch' | 'mouse';

export interface GameplayArtAssets {
    readonly board: SpriteFrame | null;
    readonly emptyCells: readonly SpriteFrame[];
    readonly occupiedCells: readonly SpriteFrame[];
}

/**
 * GameplayView.prefab 的数据绑定与交互组件。
 * 界面结构、位置、底色和字号全部由预制件控制；本组件只同步玩法数据和输入状态。
 */
@ccclass('GameplayView')
export class GameplayView extends Component {
    private scoreLabel: Label | null = null;
    private highScoreLabel: Label | null = null;
    private comboLabel: Label | null = null;
    private trayHintLabel: Label | null = null;
    private messageOverlay: Node | null = null;
    private messageTitleLabel: Label | null = null;
    private messageBodyLabel: Label | null = null;
    private messageActionLabel: Label | null = null;
    private boardFrameSprite: Sprite | null = null;
    private boardCellRoot: Node | null = null;
    private previewRoot: Node | null = null;
    private trayRoot: Node | null = null;
    private dragRoot: Node | null = null;
    private boardCellNodes: Node[] = [];
    private defaultCellFrames: Array<SpriteFrame | null> = [];
    private defaultCellColors: Color[] = [];
    private trayBounds: TrayPieceBounds[] = [];
    private draggingEntity: Entity | null = null;
    private dragPosition = new Vec3();
    private previewRow = -1;
    private previewColumn = -1;
    private previewValid = false;
    private activePointer: PointerSource | null = null;
    private viewScale = 1;
    private boardFrame: SpriteFrame | null = null;
    private occupiedCellFrames: readonly SpriteFrame[] = [];
    private lastPresentedScore = 0;
    private effectRoot: Node | null = null;
    private solidTexture: Texture2D | null = null;
    private solidSpriteFrame: SpriteFrame | null = null;

    public configureAssets(assets: GameplayArtAssets): void {
        this.boardFrame = assets.board;
        this.occupiedCellFrames = assets.occupiedCells.slice();
        this.applyBoardFrame();
        this.redraw();
    }

    protected onLoad(): void {
        if (!this.bindPrefabNodes()) {
            // 保留节点便于编辑器排查，但停止当前界面继续执行不完整的绑定逻辑。
            this.node.active = false;
            return;
        }
        this.installSolidSpriteFrame();
        // configureAssets 可能早于组件 onLoad 调用，此处在节点完成绑定后再次应用资源。
        this.applyBoardFrame();
        this.fitPrefabToScreen();
        this.captureDefaultCells();
        this.registerInput();
        this.registerEvents();
        this.redraw();
    }

    protected onDestroy(): void {
        this.node.off(Node.EventType.TOUCH_START, this.onTouchStart, this);
        this.node.off(Node.EventType.TOUCH_MOVE, this.onTouchMove, this);
        this.node.off(Node.EventType.TOUCH_END, this.onTouchEnd, this);
        this.node.off(Node.EventType.TOUCH_CANCEL, this.onTouchCancel, this);
        this.node.off(Node.EventType.MOUSE_DOWN, this.onMouseDown, this);
        this.node.off(Node.EventType.MOUSE_MOVE, this.onMouseMove, this);
        this.node.off(Node.EventType.MOUSE_UP, this.onMouseUp, this);
        this.node.off(Node.EventType.MOUSE_LEAVE, this.onMouseLeave, this);
        EventBus.clearOwner(this);
        this.solidSpriteFrame?.destroy();
        this.solidTexture?.destroy();
        this.effectRoot?.destroy();
        this.effectRoot = null;
        this.solidSpriteFrame = null;
        this.solidTexture = null;
    }

    /**
     * 预制件中的 Sprite 只负责保存尺寸、颜色和层级。统一换成本地生成的
     * 1×1 白色纹理，避免编辑器内置 SpriteFrame 在 Web/原生构建中丢失。
     */
    private installSolidSpriteFrame(): void {
        const texture = new Texture2D('GameplaySolidTexture');
        texture.reset({
            width: 1,
            height: 1,
            format: Texture2D.PixelFormat.RGBA8888,
        });
        texture.uploadData(new Uint8Array([255, 255, 255, 255]));

        const spriteFrame = new SpriteFrame('GameplaySolidSpriteFrame');
        spriteFrame.texture = texture;
        this.solidTexture = texture;
        this.solidSpriteFrame = spriteFrame;

        const sprites = this.node.getComponentsInChildren(Sprite);
        for (let index = 0; index < sprites.length; index += 1) {
            const sprite = sprites[index];
            // 棋盘底图使用场景注入的美术资源，不参与纯色占位图替换。
            if (sprite === this.boardFrameSprite) continue;
            sprite.spriteFrame = spriteFrame;
            sprite.type = Sprite.Type.SIMPLE;
            sprite.sizeMode = Sprite.SizeMode.CUSTOM;
        }
    }

    /** 按名称绑定预制件节点；缺失时记录具体路径并停用当前界面。 */
    private bindPrefabNodes(): boolean {
        this.scoreLabel = this.findComponent('ScoreCard/ScoreLabel', Label);
        this.highScoreLabel = this.findComponent('HighScoreCard/HighScoreLabel', Label);
        this.comboLabel = this.findComponent('ComboCard/ComboLabel', Label);
        this.trayHintLabel = this.findComponent('TrayHint', Label);
        this.messageOverlay = this.findNode('MessageOverlay');
        this.messageTitleLabel = this.findComponent('MessageOverlay/MessageTitle', Label);
        this.messageBodyLabel = this.findComponent('MessageOverlay/MessageBody', Label);
        this.messageActionLabel = this.findComponent('MessageOverlay/ActionBackground/MessageAction', Label);
        this.boardFrameSprite = this.findComponent('BoardFrame', Sprite);
        this.boardCellRoot = this.findNode('BoardGrid');
        this.previewRoot = this.findNode('PlacementPreview');
        this.trayRoot = this.findNode('TrayPieces');
        this.dragRoot = this.findNode('DraggingPiece');

        if (!this.scoreLabel || !this.highScoreLabel || !this.comboLabel || !this.trayHintLabel
            || !this.messageOverlay || !this.messageTitleLabel || !this.messageBodyLabel
            || !this.messageActionLabel || !this.boardFrameSprite || !this.boardCellRoot || !this.previewRoot
            || !this.trayRoot || !this.dragRoot) {
            Logger.error('GameplayView 预制件结构不完整，已停用玩法界面');
            return false;
        }

        this.boardCellNodes = this.boardCellRoot.children.slice(0, BoardConfig.width * BoardConfig.height);
        if (this.boardCellNodes.length !== BoardConfig.width * BoardConfig.height) {
            Logger.error(`GameplayView 棋盘必须包含 ${BoardConfig.width * BoardConfig.height} 个格子，当前为 ${this.boardCellNodes.length} 个`);
            return false;
        }
        return true;
    }

    /** 把场景持有的棋盘资源应用到预制件静态节点。 */
    private applyBoardFrame(): void {
        if (!this.boardFrameSprite || !this.boardFrame) return;
        this.boardFrameSprite.spriteFrame = this.boardFrame;
        // 资源已在导入配置中裁掉透明边距，简单缩放能完整保留猫爪与圆角装饰。
        this.boardFrameSprite.type = Sprite.Type.SIMPLE;
        this.boardFrameSprite.sizeMode = Sprite.SizeMode.CUSTOM;
        this.boardFrameSprite.color = Color.WHITE;
    }

    /** 将整个 360×720 预制件统一缩放并保持屏幕正中。 */
    private fitPrefabToScreen(): void {
        const visibleSize = view.getVisibleSize();
        this.viewScale = Math.min(
            (visibleSize.width - 24) / DESIGN_WIDTH,
            (visibleSize.height - 24) / DESIGN_HEIGHT,
        );
        this.node.setPosition(0, 0);
        this.node.setScale(this.viewScale, this.viewScale, 1);
    }

    /** 保存预制件内 64 个空格的外观，空位恢复时不会再由代码重画。 */
    private captureDefaultCells(): void {
        this.defaultCellFrames = [];
        this.defaultCellColors = [];
        for (const node of this.boardCellNodes) {
            const sprite = node.getComponent(Sprite);
            this.defaultCellFrames.push(sprite?.spriteFrame ?? null);
            this.defaultCellColors.push(sprite?.color.clone() ?? Color.WHITE.clone());
        }
    }

    /** 安全查找预制件节点，未找到时返回空值。 */
    private findNode(path: string): Node | null {
        let current: Node | null = this.node;
        for (const name of path.split('/')) current = current?.getChildByName(name) ?? null;
        if (!current) Logger.error(`GameplayView 预制件缺少节点：${path}`);
        return current;
    }

    /** 安全查找节点组件，未配置时返回空值。 */
    private findComponent<T extends Component>(path: string, type: new (...args: never[]) => T): T | null {
        const node = this.findNode(path);
        if (!node) return null;
        const component = node.getComponent(type);
        if (!component) Logger.error(`GameplayView 节点 ${path} 缺少组件：${type.name}`);
        return component;
    }

    private registerInput(): void {
        this.node.on(Node.EventType.TOUCH_START, this.onTouchStart, this);
        this.node.on(Node.EventType.TOUCH_MOVE, this.onTouchMove, this);
        this.node.on(Node.EventType.TOUCH_END, this.onTouchEnd, this);
        this.node.on(Node.EventType.TOUCH_CANCEL, this.onTouchCancel, this);
        this.node.on(Node.EventType.MOUSE_DOWN, this.onMouseDown, this);
        this.node.on(Node.EventType.MOUSE_MOVE, this.onMouseMove, this);
        this.node.on(Node.EventType.MOUSE_UP, this.onMouseUp, this);
        this.node.on(Node.EventType.MOUSE_LEAVE, this.onMouseLeave, this);
    }

    private registerEvents(): void {
        EventBus.on<GameStateChange>(GameEvents.StateChanged, this.onStateChanged, this);
        EventBus.on<PiecePlacedEvent>(GameplayEvents.PiecePlaced, this.onPiecePlaced, this);
        EventBus.on<PlacementRejectedEvent>(GameplayEvents.PlacementRejected, this.onPlacementRejected, this);
        EventBus.on<MoveResolvedEvent>(GameplayEvents.MoveResolved, this.onMoveResolved, this);
        EventBus.on<ScoreChangedEvent>(GameplayEvents.ScoreChanged, this.onScoreChanged, this);
        EventBus.on(GameplayEvents.TrayRefilled, this.redraw, this);
        EventBus.on(GameplayEvents.GameOver, this.redraw, this);
    }

    private onTouchStart(event: EventTouch): void {
        if (this.activePointer !== null) return;
        this.activePointer = 'touch';
        this.beginPointer(this.pointerToLocal(event));
    }

    private onTouchMove(event: EventTouch): void {
        if (this.activePointer !== 'touch') return;
        this.movePointer(this.pointerToLocal(event));
    }

    private onTouchEnd(): void {
        if (this.activePointer !== 'touch') return;
        this.endPointer();
    }

    private onTouchCancel(): void {
        if (this.activePointer !== 'touch') return;
        this.cancelPointer();
    }

    private onMouseDown(event: EventMouse): void {
        if (event.getButton() !== EventMouse.BUTTON_LEFT || this.activePointer !== null) return;
        this.activePointer = 'mouse';
        this.beginPointer(this.pointerToLocal(event));
    }

    private onMouseMove(event: EventMouse): void {
        if (this.activePointer !== 'mouse') return;
        this.movePointer(this.pointerToLocal(event));
    }

    private onMouseUp(event: EventMouse): void {
        if (event.getButton() !== EventMouse.BUTTON_LEFT || this.activePointer !== 'mouse') return;
        this.endPointer();
    }

    private onMouseLeave(): void {
        if (this.activePointer !== 'mouse') return;
        this.cancelPointer();
    }

    private beginPointer(position: Vec3): void {
        const state = GameManager.instance.currentState;
        if (state === GameState.Menu || state === GameState.GameOver) {
            if (GameManager.instance.changeState(GameState.Playing)) {
                GameplayModule.instance.startSession();
                this.redraw();
            }
            return;
        }
        if (state !== GameState.Playing) return;

        for (const bounds of this.trayBounds) {
            if (position.x < bounds.left || position.x > bounds.right) continue;
            if (position.y < bounds.bottom || position.y > bounds.top) continue;
            this.draggingEntity = bounds.entity;
            this.updateDragPosition(position);
            this.updatePreview();
            this.redraw();
            return;
        }
    }

    private movePointer(position: Vec3): void {
        if (this.draggingEntity === null) return;
        this.updateDragPosition(position);
        this.updatePreview();
        this.redraw();
    }

    private endPointer(): void {
        if (this.draggingEntity !== null && this.previewValid) {
            GameplayModule.instance.requestPlacement(this.draggingEntity, this.previewRow, this.previewColumn);
        }
        this.activePointer = null;
        this.resetDrag();
        this.redraw();
    }

    private cancelPointer(): void {
        this.activePointer = null;
        this.resetDrag();
        this.redraw();
    }

    private updateDragPosition(position: Vec3): void {
        this.dragPosition.set(position.x, position.y + 56, 0);
    }

    private updatePreview(): void {
        this.previewRow = -1;
        this.previewColumn = -1;
        this.previewValid = false;
        if (this.draggingEntity === null) return;

        const board = GameplayModule.instance.getBoard();
        const piece = GameplayModule.instance.getPiece(this.draggingEntity);
        if (!board || !piece) return;
        const bounds = this.pieceBounds(piece.cells);
        const originX = this.dragPosition.x - bounds.width * BOARD_CELL_SIZE * 0.5;
        const originY = this.dragPosition.y + bounds.height * BOARD_CELL_SIZE * 0.5;
        const column = Math.round((originX - BOARD_LEFT) / BOARD_CELL_SIZE);
        const row = Math.round((BOARD_TOP - originY) / BOARD_CELL_SIZE);
        if (!this.isNearBoard(row, column, bounds.width, bounds.height)) return;

        this.previewRow = row;
        this.previewColumn = column;
        this.previewValid = canPlace(board, piece, row, column);
    }

    private isNearBoard(row: number, column: number, width: number, height: number): boolean {
        return row > -height && row < BoardConfig.height
            && column > -width && column < BoardConfig.width;
    }

    private redraw = (): void => {
        if (!this.scoreLabel || !this.highScoreLabel || !this.comboLabel) return;
        const state = GameManager.instance.currentState;
        const score = GameplayModule.instance.getScore();
        // 单局存在时直接使用内存数据，避免拖拽重绘期间频繁访问 localStorage。
        const highScore = score?.highScore ?? GameplayModule.instance.getPlayerRecord().highScore;
        this.scoreLabel.string = `分数\n${score?.score ?? 0}`;
        this.highScoreLabel.string = `最高\n${highScore}`;
        this.comboLabel.string = `连击\n×${score?.combo ?? 0}`;

        if (state === GameState.Menu) {
            if (this.messageOverlay) this.messageOverlay.active = true;
            if (this.messageTitleLabel) this.messageTitleLabel.string = '猫咪新居';
            if (this.messageBodyLabel) this.messageBodyLabel.string = '把猫箱放进棋盘\n填满整行或整列即可消除';
            if (this.messageActionLabel) this.messageActionLabel.string = '点击任意位置开始';
            if (this.trayHintLabel) this.trayHintLabel.node.active = false;
            this.syncBoard(null);
            this.hidePooledSprites(this.previewRoot);
            this.hidePooledSprites(this.trayRoot);
            this.hidePooledSprites(this.dragRoot);
            return;
        }

        if (this.trayHintLabel) this.trayHintLabel.node.active = state === GameState.Playing;
        if (this.messageOverlay) this.messageOverlay.active = state === GameState.GameOver;
        if (state === GameState.GameOver) {
            if (this.messageTitleLabel) this.messageTitleLabel.string = '本局结束';
            if (this.messageBodyLabel) {
                this.messageBodyLabel.string = `得分  ${score?.score ?? 0}    最高  ${score?.highScore ?? 0}\n小猫们已经等着下一局啦`;
            }
            if (this.messageActionLabel) this.messageActionLabel.string = '再玩一局';
        }
        this.syncBoard(GameplayModule.instance.getBoard());
        this.syncTray();
        this.syncPreview();
        this.syncDraggingPiece();
    };

    /** 将棋盘数据写入预制件中的 64 个格子，空格恢复预制件外观。 */
    private syncBoard(board: ReturnType<GameplayModule['getBoard']>): void {
        for (let index = 0; index < this.boardCellNodes.length; index += 1) {
            const node = this.boardCellNodes[index];
            const sprite = node.getComponent(Sprite);
            if (!sprite) continue;
            const occupied = board ? board.occupied[index] !== 0 : false;
            if (occupied && board) {
                sprite.spriteFrame = this.frameAt(this.occupiedCellFrames, board.visualStyles[index]);
                sprite.color = Color.WHITE;
                this.setSpriteSize(node, 42);
            } else {
                sprite.spriteFrame = this.defaultCellFrames[index] ?? null;
                sprite.color = this.defaultCellColors[index] ?? Color.WHITE;
                this.setSpriteSize(node, 38);
            }
            node.active = true;
        }
    }

    /** 普通形状使用约 78% 棋盘格尺寸，只有超长形状才按槽位自动缩小。 */
    private syncTray(): void {
        const tray = GameplayModule.instance.getTray();
        this.trayBounds = [];
        this.hidePooledSprites(this.trayRoot);
        if (!tray || !this.trayRoot) return;
        let spriteIndex = 0;

        for (const entity of tray.pieceEntities) {
            const piece = GameplayModule.instance.getPiece(entity);
            if (!piece || entity === this.draggingEntity) continue;
            const bounds = this.pieceBounds(piece.cells);
            const size = Math.min(
                TRAY_CELL_SIZE,
                (TRAY_SLOT_WIDTH - 10) / bounds.width,
                (TRAY_SLOT_HEIGHT - 10) / bounds.height,
            );
            const slotX = (piece.trayIndex - 1) * TRAY_SLOT_STEP;
            const left = slotX - bounds.width * size * 0.5;
            const top = TRAY_SLOT_Y + bounds.height * size * 0.5;
            spriteIndex = this.syncPieceSprites(this.trayRoot, spriteIndex, piece, left, top, size, 255, Color.WHITE);
            this.trayBounds.push({
                entity,
                left: slotX - TRAY_SLOT_WIDTH * 0.5,
                right: slotX + TRAY_SLOT_WIDTH * 0.5,
                bottom: TRAY_SLOT_Y - TRAY_SLOT_HEIGHT * 0.5,
                top: TRAY_SLOT_Y + TRAY_SLOT_HEIGHT * 0.5,
            });
        }
    }

    private syncPreview(): void {
        this.hidePooledSprites(this.previewRoot);
        if (!this.previewRoot || this.draggingEntity === null || this.previewRow < 0 || this.previewColumn < 0) return;
        const piece = GameplayModule.instance.getPiece(this.draggingEntity);
        if (!piece) return;
        this.syncPieceSprites(
            this.previewRoot,
            0,
            piece,
            BOARD_LEFT + this.previewColumn * BOARD_CELL_SIZE,
            BOARD_TOP - this.previewRow * BOARD_CELL_SIZE,
            BOARD_CELL_SIZE,
            this.previewValid ? 170 : 115,
            this.previewValid ? new Color(185, 255, 196, 255) : new Color(255, 118, 118, 255),
        );
    }

    private syncDraggingPiece(): void {
        this.hidePooledSprites(this.dragRoot);
        if (!this.dragRoot || this.draggingEntity === null) return;
        const piece = GameplayModule.instance.getPiece(this.draggingEntity);
        if (!piece) return;
        const bounds = this.pieceBounds(piece.cells);
        this.syncPieceSprites(
            this.dragRoot,
            0,
            piece,
            this.dragPosition.x - bounds.width * BOARD_CELL_SIZE * 0.5,
            this.dragPosition.y + bounds.height * BOARD_CELL_SIZE * 0.5,
            BOARD_CELL_SIZE,
            235,
            Color.WHITE,
        );
    }

    private syncPieceSprites(
        root: Node,
        startIndex: number,
        piece: PieceComponent,
        left: number,
        top: number,
        size: number,
        opacity: number,
        color: Color,
    ): number {
        let spriteIndex = startIndex;
        const frame = this.frameAt(this.occupiedCellFrames, piece.visualStyle);
        for (const cell of piece.cells) {
            const node = this.getPooledSpriteNode(root, spriteIndex);
            node.active = true;
            node.setPosition(left + (cell.column + 0.5) * size, top - (cell.row + 0.5) * size);
            node.getComponent(Sprite)!.spriteFrame = frame;
            node.getComponent(Sprite)!.color = color;
            node.getComponent(UIOpacity)!.opacity = opacity;
            this.setSpriteSize(node, size * 1.04);
            spriteIndex += 1;
        }
        return spriteIndex;
    }

    private onPiecePlaced = (event: PiecePlacedEvent): void => {
        this.redraw();
        const board = GameplayModule.instance.getBoard();
        for (const boardIndex of event.placedIndices) {
            if (!board || board.occupied[boardIndex] === 0) continue;
            const node = this.boardCellNodes[boardIndex];
            if (!node || !node.active) continue;
            Tween.stopAllByTarget(node);
            node.setScale(0.78, 0.78, 1);
            tween(node).to(0.12, { scale: Vec3.ONE }, { easing: 'backOut' }).start();
        }
    };

    /** 新对局重置表现层计分基线，暂停恢复时保持当前分数。 */
    private onStateChanged = (change: GameStateChange): void => {
        if (change.current === GameState.Playing
            && (change.previous === GameState.Menu || change.previous === GameState.GameOver)) {
            this.lastPresentedScore = 0;
        }
        this.redraw();
    };

    /** 使用被清除格的快照播放消散动画，避免规则层立即清空造成视觉跳变。 */
    private onMoveResolved = (event: MoveResolvedEvent): void => {
        this.redraw();
        if (event.lineCount <= 0 || event.clearedCells.length === 0) return;

        const root = this.getEffectRoot();
        for (let index = 0; index < event.clearedCells.length; index += 1) {
            const cell = event.clearedCells[index];
            const node = this.createSpriteNode(root, `ClearCell_${cell.index}`);
            const row = Math.floor(cell.index / BoardConfig.width);
            const column = cell.index % BoardConfig.width;
            node.setPosition(
                BOARD_LEFT + (column + 0.5) * BOARD_CELL_SIZE,
                BOARD_TOP - (row + 0.5) * BOARD_CELL_SIZE,
            );
            node.setScale(1, 1, 1);
            node.getComponent(Sprite)!.spriteFrame = this.frameAt(this.occupiedCellFrames, cell.visualStyle);
            node.getComponent(Sprite)!.color = Color.WHITE;
            node.getComponent(UIOpacity)!.opacity = 255;
            this.setSpriteSize(node, BOARD_CELL_SIZE * 1.04);

            const delay = index * 0.012;
            tween(node)
                .delay(delay)
                .to(0.08, { scale: new Vec3(1.18, 1.18, 1) }, { easing: 'quadOut' })
                .to(0.16, { scale: new Vec3(0.08, 0.08, 1) }, { easing: 'quadIn' })
                .call(() => node.destroy())
                .start();
            tween(node.getComponent(UIOpacity)!)
                .delay(delay + 0.06)
                .to(0.18, { opacity: 0 })
                .start();
        }
    };

    /** 展示本次得分增量，并在连击增长时强调连击卡片。 */
    private onScoreChanged = (event: ScoreChangedEvent): void => {
        const gainedScore = Math.max(0, event.score - this.lastPresentedScore);
        this.lastPresentedScore = event.score;
        this.redraw();
        if (gainedScore > 0) this.showScoreGain(gainedScore);
        if (event.combo > 0 && this.comboLabel) {
            const comboNode = this.comboLabel.node;
            Tween.stopAllByTarget(comboNode);
            comboNode.setScale(1, 1, 1);
            tween(comboNode)
                .to(0.1, { scale: new Vec3(1.18, 1.18, 1) }, { easing: 'backOut' })
                .to(0.12, { scale: Vec3.ONE })
                .start();
        }
    };

    /** 创建短暂的分数飘字；节点数量由每次结算动态决定。 */
    private showScoreGain(score: number): void {
        const node = new Node('ScoreGain');
        node.layer = Layers.Enum.UI_2D;
        node.addComponent(UITransform).setContentSize(180, 40);
        const label = node.addComponent(Label);
        label.string = `+${score}`;
        label.fontSize = 24;
        label.lineHeight = 28;
        label.color = new Color(239, 113, 73, 255);
        label.horizontalAlign = Label.HorizontalAlign.CENTER;
        label.verticalAlign = Label.VerticalAlign.CENTER;
        const opacity = node.addComponent(UIOpacity);
        this.getEffectRoot().addChild(node);
        node.setPosition(0, 58);

        tween(node)
            .by(0.55, { position: new Vec3(0, 44, 0) }, { easing: 'quadOut' })
            .call(() => node.destroy())
            .start();
        tween(opacity).delay(0.25).to(0.3, { opacity: 0 }).start();
    }

    private onPlacementRejected = (_event: PlacementRejectedEvent): void => {
        this.resetDrag();
        this.redraw();
    };

    /** 获取运行时特效容器；消除与飘字结束后会自行销毁子节点。 */
    private getEffectRoot(): Node {
        if (this.effectRoot?.isValid) return this.effectRoot;
        const root = new Node('GameplayEffects');
        root.layer = Layers.Enum.UI_2D;
        root.addComponent(UITransform);
        this.node.addChild(root);
        this.effectRoot = root;
        return root;
    }

    private createSpriteNode(root: Node, name: string): Node {
        const node = new Node(name);
        node.layer = Layers.Enum.UI_2D;
        node.addComponent(UITransform);
        const sprite = node.addComponent(Sprite);
        sprite.sizeMode = Sprite.SizeMode.CUSTOM;
        node.addComponent(UIOpacity);
        root.addChild(node);
        return node;
    }

    private getPooledSpriteNode(root: Node, index: number): Node {
        while (root.children.length <= index) this.createSpriteNode(root, `${root.name}_${root.children.length}`);
        return root.children[index];
    }

    private hidePooledSprites(root: Node | null): void {
        if (!root) return;
        for (const child of root.children) child.active = false;
    }

    private frameAt(frames: readonly SpriteFrame[], index: number): SpriteFrame | null {
        if (frames.length === 0) return null;
        return frames[Math.abs(index) % frames.length];
    }

    private setSpriteSize(node: Node, size: number): void {
        node.getComponent(UITransform)?.setContentSize(size, size);
    }

    private pieceBounds(cells: readonly { row: number; column: number }[]): { width: number; height: number } {
        let maxRow = 0;
        let maxColumn = 0;
        for (const cell of cells) {
            maxRow = Math.max(maxRow, cell.row);
            maxColumn = Math.max(maxColumn, cell.column);
        }
        return { width: maxColumn + 1, height: maxRow + 1 };
    }

    /** 屏幕坐标先转为中心原点，再除以预制件整体缩放。 */
    private pointerToLocal(event: EventTouch | EventMouse): Vec3 {
        const visibleSize = view.getVisibleSize();
        const location = event.getUILocation();
        return new Vec3(
            (location.x - visibleSize.width * 0.5) / this.viewScale,
            (location.y - visibleSize.height * 0.5) / this.viewScale,
            0,
        );
    }

    private resetDrag(): void {
        this.draggingEntity = null;
        this.previewRow = -1;
        this.previewColumn = -1;
        this.previewValid = false;
    }
}
