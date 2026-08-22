import {
    _decorator,
    Color,
    Component,
    EventTouch,
    Graphics,
    HorizontalTextAlignment,
    Label,
    Layers,
    Node,
    Sprite,
    SpriteFrame,
    Tween,
    UIOpacity,
    UITransform,
    Vec3,
    VerticalTextAlignment,
    view,
    tween,
} from 'cc';
import { EventBus } from '../../core/EventBus';
import { GameManager } from '../../core/GameManager';
import { BoardConfig } from '../config/BoardConfig';
import type { PieceComponent } from '../ecs/components/PieceComponent';
import type { Entity } from '../ecs/core/Entity';
import {
    GameplayEvents,
    type PiecePlacedEvent,
    type PlacementRejectedEvent,
} from '../ecs/events/GameplayEvents';
import { GameplayModule } from '../GameplayModule';
import { GameEvents, GameState } from '../GameState';
import { canPlace } from '../logic/BoardRules';

const { ccclass } = _decorator;

/** 待选方块在当前全屏节点内的触摸区域。 */
interface TrayPieceBounds {
    readonly entity: Entity;
    readonly left: number;
    readonly right: number;
    readonly bottom: number;
    readonly top: number;
}

/** 由入口组件注入的棋盘美术资源。 */
export interface GameplayArtAssets {
    readonly board: SpriteFrame | null;
    readonly emptyCells: readonly SpriteFrame[];
    readonly occupiedCells: readonly SpriteFrame[];
}

/**
 * 基础玩法表现与棋盘输入组件。
 * ECS 只提供棋盘状态，本组件负责资源显示、拖拽命中、吸附预览和操作反馈。
 */
@ccclass('GameplayView')
export class GameplayView extends Component {
    private backgroundGraphics: Graphics | null = null;
    private statusLabel: Label | null = null;
    private transform: UITransform | null = null;
    private boardArtSprite: Sprite | null = null;
    private boardCellRoot: Node | null = null;
    private previewRoot: Node | null = null;
    private trayRoot: Node | null = null;
    private dragRoot: Node | null = null;
    private boardCellNodes: Node[] = [];
    private width = 0;
    private height = 0;
    private cellSize = 0;
    private boardLeft = 0;
    private boardTop = 0;
    private trayY = 0;
    private trayBounds: TrayPieceBounds[] = [];
    private draggingEntity: Entity | null = null;
    private dragPosition = new Vec3();
    private previewRow = -1;
    private previewColumn = -1;
    private previewValid = false;
    private boardFrame: SpriteFrame | null = null;
    private emptyCellFrames: readonly SpriteFrame[] = [];
    private occupiedCellFrames: readonly SpriteFrame[] = [];

    /** 注入场景持有的资源引用，并立即刷新全部棋盘节点。 */
    public configureAssets(assets: GameplayArtAssets): void {
        this.boardFrame = assets.board;
        this.emptyCellFrames = assets.emptyCells.slice();
        this.occupiedCellFrames = assets.occupiedCells.slice();
        if (this.boardArtSprite) this.boardArtSprite.spriteFrame = this.boardFrame;
        this.redraw();
    }

    protected onLoad(): void {
        const visibleSize = view.getVisibleSize();
        this.width = visibleSize.width;
        this.height = visibleSize.height;
        this.cellSize = Math.floor(Math.min(
            (this.width - 44) / BoardConfig.width,
            (this.height - 280) / BoardConfig.height,
        ));
        this.boardLeft = -this.cellSize * BoardConfig.width * 0.5;
        this.boardTop = this.height * 0.5 - 90;
        this.trayY = this.boardTop - this.cellSize * BoardConfig.height - 82;

        this.transform = this.node.addComponent(UITransform);
        this.transform.setContentSize(this.width, this.height);
        this.backgroundGraphics = this.node.addComponent(Graphics);
        this.createRenderLayers();
        this.createStatusLabel();
        this.createBoardCells();
        this.registerInput();
        this.registerEvents();
        this.redraw();
    }

    protected onDestroy(): void {
        this.node.off(Node.EventType.TOUCH_START, this.onTouchStart, this);
        this.node.off(Node.EventType.TOUCH_MOVE, this.onTouchMove, this);
        this.node.off(Node.EventType.TOUCH_END, this.onTouchEnd, this);
        this.node.off(Node.EventType.TOUCH_CANCEL, this.onTouchCancel, this);
        EventBus.clearOwner(this);
    }

    /** 创建按渲染顺序排列的棋盘、预览、待选和拖拽层。 */
    private createRenderLayers(): void {
        const boardArtNode = this.createLayerNode('BoardArtwork');
        const boardArtTransform = boardArtNode.getComponent(UITransform);
        const boardSize = this.cellSize * BoardConfig.width;
        boardArtTransform?.setContentSize(boardSize * 1.82, boardSize * 1.98);
        boardArtNode.setPosition(0, this.boardTop - boardSize * 0.5);
        this.boardArtSprite = boardArtNode.addComponent(Sprite);
        this.boardArtSprite.sizeMode = Sprite.SizeMode.CUSTOM;

        this.boardCellRoot = this.createLayerNode('BoardCells');
        this.previewRoot = this.createLayerNode('PlacementPreview');
        this.trayRoot = this.createLayerNode('TrayPieces');
        this.dragRoot = this.createLayerNode('DraggingPiece');
    }

    /** 创建全屏坐标系下的普通 UI 渲染层。 */
    private createLayerNode(name: string): Node {
        const layer = new Node(name);
        layer.layer = Layers.Enum.UI_2D;
        layer.addComponent(UITransform);
        this.node.addChild(layer);
        return layer;
    }

    /** 预创建 8×8 棋盘格节点，拖动期间只更新资源和显隐。 */
    private createBoardCells(): void {
        if (!this.boardCellRoot) return;
        const cellCount = BoardConfig.width * BoardConfig.height;
        for (let index = 0; index < cellCount; index += 1) {
            const node = this.createSpriteNode(this.boardCellRoot, `Cell_${index}`);
            const row = Math.floor(index / BoardConfig.width);
            const column = index % BoardConfig.width;
            node.setPosition(
                this.boardLeft + (column + 0.5) * this.cellSize,
                this.boardTop - (row + 0.5) * this.cellSize,
            );
            this.setSpriteSize(node, this.cellSize * 1.04);
            this.boardCellNodes.push(node);
        }
    }

    /** 创建顶部状态文字。 */
    private createStatusLabel(): void {
        const labelNode = new Node('StatusLabel');
        labelNode.layer = Layers.Enum.UI_2D;
        labelNode.setPosition(0, this.height * 0.5 - 38);
        this.node.addChild(labelNode);
        const transform = labelNode.addComponent(UITransform);
        transform.setContentSize(this.width - 24, 70);
        const label = labelNode.addComponent(Label);
        label.fontSize = 24;
        label.lineHeight = 30;
        label.color = new Color(92, 55, 32, 255);
        label.horizontalAlign = HorizontalTextAlignment.CENTER;
        label.verticalAlign = VerticalTextAlignment.CENTER;
        this.statusLabel = label;
    }

    /** 注册全屏触摸输入。 */
    private registerInput(): void {
        this.node.on(Node.EventType.TOUCH_START, this.onTouchStart, this);
        this.node.on(Node.EventType.TOUCH_MOVE, this.onTouchMove, this);
        this.node.on(Node.EventType.TOUCH_END, this.onTouchEnd, this);
        this.node.on(Node.EventType.TOUCH_CANCEL, this.onTouchCancel, this);
    }

    /** 监听会改变棋盘或待选区显示的数据事件。 */
    private registerEvents(): void {
        EventBus.on(GameEvents.StateChanged, this.redraw, this);
        EventBus.on<PiecePlacedEvent>(GameplayEvents.PiecePlaced, this.onPiecePlaced, this);
        EventBus.on<PlacementRejectedEvent>(GameplayEvents.PlacementRejected, this.onPlacementRejected, this);
        EventBus.on(GameplayEvents.MoveResolved, this.redraw, this);
        EventBus.on(GameplayEvents.ScoreChanged, this.redraw, this);
        EventBus.on(GameplayEvents.TrayRefilled, this.redraw, this);
        EventBus.on(GameplayEvents.GameOver, this.redraw, this);
    }

    /** 点击菜单或结算画面开始新游戏，否则尝试选中待放方块。 */
    private onTouchStart(event: EventTouch): void {
        const state = GameManager.instance.currentState;
        if (state === GameState.Menu || state === GameState.GameOver) {
            if (GameManager.instance.changeState(GameState.Playing)) {
                GameplayModule.instance.startSession();
                this.redraw();
            }
            return;
        }
        if (state !== GameState.Playing) return;

        const position = this.touchToLocal(event);
        for (let index = 0; index < this.trayBounds.length; index += 1) {
            const bounds = this.trayBounds[index];
            if (position.x < bounds.left || position.x > bounds.right) continue;
            if (position.y < bounds.bottom || position.y > bounds.top) continue;
            this.draggingEntity = bounds.entity;
            this.updateDragPosition(position);
            this.updatePreview();
            this.redraw();
            return;
        }
    }

    /** 更新拖动位置和棋盘吸附预览。 */
    private onTouchMove(event: EventTouch): void {
        if (this.draggingEntity === null) return;
        this.updateDragPosition(this.touchToLocal(event));
        this.updatePreview();
        this.redraw();
    }

    /** 松手时只提交合法预览，非法落点会立即返回待选区。 */
    private onTouchEnd(): void {
        if (this.draggingEntity === null) return;
        if (this.previewValid) {
            GameplayModule.instance.requestPlacement(
                this.draggingEntity,
                this.previewRow,
                this.previewColumn,
            );
        }
        this.resetDrag();
        this.redraw();
    }

    /** 触摸被系统取消时让方块返回待选区。 */
    private onTouchCancel(): void {
        this.resetDrag();
        this.redraw();
    }

    /** 让拖拽方块保持在手指上方，避免手指遮挡实际落点。 */
    private updateDragPosition(touchPosition: Vec3): void {
        const lift = Math.max(72, this.cellSize * 1.35);
        this.dragPosition.set(touchPosition.x, touchPosition.y + lift, 0);
    }

    /** 根据拖动位置计算棋盘原点，并同步合法性。 */
    private updatePreview(): void {
        this.previewRow = -1;
        this.previewColumn = -1;
        this.previewValid = false;
        if (this.draggingEntity === null) return;

        const board = GameplayModule.instance.getBoard();
        const piece = GameplayModule.instance.getPiece(this.draggingEntity);
        if (!board || !piece) return;
        const bounds = this.pieceBounds(piece.cells);
        const originX = this.dragPosition.x - bounds.width * this.cellSize * 0.5;
        const originY = this.dragPosition.y + bounds.height * this.cellSize * 0.5;
        const column = Math.round((originX - this.boardLeft) / this.cellSize);
        const row = Math.round((this.boardTop - originY) / this.cellSize);
        if (!this.isNearBoard(row, column, bounds.width, bounds.height)) return;

        this.previewRow = row;
        this.previewColumn = column;
        this.previewValid = canPlace(board, piece, row, column);
    }

    /** 过滤离棋盘过远的拖拽位置，避免在待选区显示无意义的红色预览。 */
    private isNearBoard(row: number, column: number, width: number, height: number): boolean {
        return row > -height && row < BoardConfig.height
            && column > -width && column < BoardConfig.width;
    }

    /** 绘制当前完整游戏状态。 */
    private redraw = (): void => {
        if (!this.backgroundGraphics || !this.statusLabel) return;
        this.drawBackground();
        if (this.boardArtSprite) this.boardArtSprite.spriteFrame = this.boardFrame;

        const state = GameManager.instance.currentState;
        const score = GameplayModule.instance.getScore();
        if (state === GameState.Menu) {
            this.statusLabel.string = 'CatBlock\n点击任意位置开始';
            this.syncBoard(null);
            this.hidePooledSprites(this.previewRoot);
            this.hidePooledSprites(this.trayRoot);
            this.hidePooledSprites(this.dragRoot);
            return;
        }

        this.statusLabel.string = state === GameState.GameOver
            ? `游戏结束  分数 ${score?.score ?? 0}  最高 ${score?.highScore ?? 0}\n点击重新开始`
            : `分数 ${score?.score ?? 0}   最高 ${score?.highScore ?? 0}   连击 ${score?.combo ?? 0}`;
        this.syncBoard(GameplayModule.instance.getBoard());
        this.syncTray();
        this.syncPreview();
        this.syncDraggingPiece();
    };

    /** 绘制暖色全屏背景。 */
    private drawBackground(): void {
        if (!this.backgroundGraphics) return;
        this.backgroundGraphics.clear();
        this.backgroundGraphics.fillColor = new Color(255, 244, 224, 255);
        this.backgroundGraphics.rect(-this.width * 0.5, -this.height * 0.5, this.width, this.height);
        this.backgroundGraphics.fill();
    }

    /** 将 ECS 棋盘状态同步到 64 个常驻 Sprite 节点。 */
    private syncBoard(board: ReturnType<GameplayModule['getBoard']>): void {
        for (let index = 0; index < this.boardCellNodes.length; index += 1) {
            const occupied = board ? board.occupied[index] !== 0 : false;
            const style = occupied && board ? board.visualStyles[index] : index;
            this.setSpriteFrame(
                this.boardCellNodes[index],
                occupied ? this.frameAt(this.occupiedCellFrames, style) : this.frameAt(this.emptyCellFrames, style),
            );
        }
    }

    /** 同步三个待选槽位，并记录更宽松的整槽触摸范围。 */
    private syncTray(): void {
        const tray = GameplayModule.instance.getTray();
        this.trayBounds = [];
        this.hidePooledSprites(this.trayRoot);
        if (!tray || !this.trayRoot) return;
        const trayCellSize = Math.max(20, Math.floor(this.cellSize * 0.5));
        let spriteIndex = 0;

        for (let index = 0; index < tray.pieceEntities.length; index += 1) {
            const entity = tray.pieceEntities[index];
            const piece = GameplayModule.instance.getPiece(entity);
            if (!piece || entity === this.draggingEntity) continue;
            const bounds = this.pieceBounds(piece.cells);
            const slotX = -this.width * 0.5 + this.width * (piece.trayIndex + 1) / 4;
            const left = slotX - bounds.width * trayCellSize * 0.5;
            const top = this.trayY + bounds.height * trayCellSize * 0.5;
            spriteIndex = this.syncPieceSprites(
                this.trayRoot,
                spriteIndex,
                piece,
                left,
                top,
                trayCellSize,
                255,
                Color.WHITE,
            );
            const slotHalfWidth = this.width / 8 - 6;
            this.trayBounds.push({
                entity,
                left: slotX - slotHalfWidth,
                right: slotX + slotHalfWidth,
                bottom: this.trayY - Math.max(52, trayCellSize * 1.5),
                top: this.trayY + Math.max(52, trayCellSize * 1.5),
            });
        }
    }

    /** 使用半透明资源格显示吸附落点，红色表示占用冲突或越界。 */
    private syncPreview(): void {
        this.hidePooledSprites(this.previewRoot);
        if (!this.previewRoot || this.draggingEntity === null || this.previewRow < 0 || this.previewColumn < 0) return;
        const piece = GameplayModule.instance.getPiece(this.draggingEntity);
        if (!piece) return;
        const left = this.boardLeft + this.previewColumn * this.cellSize;
        const top = this.boardTop - this.previewRow * this.cellSize;
        this.syncPieceSprites(
            this.previewRoot,
            0,
            piece,
            left,
            top,
            this.cellSize,
            this.previewValid ? 170 : 115,
            this.previewValid ? new Color(185, 255, 196, 255) : new Color(255, 118, 118, 255),
        );
    }

    /** 显示正在手指上方跟随移动的原尺寸方块。 */
    private syncDraggingPiece(): void {
        this.hidePooledSprites(this.dragRoot);
        if (!this.dragRoot || this.draggingEntity === null) return;
        const piece = GameplayModule.instance.getPiece(this.draggingEntity);
        if (!piece) return;
        const bounds = this.pieceBounds(piece.cells);
        const left = this.dragPosition.x - bounds.width * this.cellSize * 0.5;
        const top = this.dragPosition.y + bounds.height * this.cellSize * 0.5;
        this.syncPieceSprites(this.dragRoot, 0, piece, left, top, this.cellSize, 235, Color.WHITE);
    }

    /** 把一个方块同步到指定 Sprite 池，返回下一个可写池索引。 */
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
        for (let index = 0; index < piece.cells.length; index += 1) {
            const cell = piece.cells[index];
            const node = this.getPooledSpriteNode(root, spriteIndex);
            node.active = true;
            node.setPosition(
                left + (cell.column + 0.5) * size,
                top - (cell.row + 0.5) * size,
            );
            node.getComponent(Sprite)!.spriteFrame = frame;
            node.getComponent(Sprite)!.color = color;
            node.getComponent(UIOpacity)!.opacity = opacity;
            this.setSpriteSize(node, size * 1.04);
            spriteIndex += 1;
        }
        return spriteIndex;
    }

    /** 放置成功后刷新棋盘，并给新写入格播放轻量弹性反馈。 */
    private onPiecePlaced = (event: PiecePlacedEvent): void => {
        this.redraw();
        const board = GameplayModule.instance.getBoard();
        for (let index = 0; index < event.placedIndices.length; index += 1) {
            const boardIndex = event.placedIndices[index];
            if (!board || board.occupied[boardIndex] === 0) continue;
            const node = this.boardCellNodes[boardIndex];
            if (!node || !node.active) continue;
            Tween.stopAllByTarget(node);
            node.setScale(0.78, 0.78, 1);
            tween(node).to(0.12, { scale: Vec3.ONE }, { easing: 'backOut' }).start();
        }
    };

    /** ECS 拒绝请求时恢复待选区；输入层通常会在提交前拦截非法落点。 */
    private onPlacementRejected = (_event: PlacementRejectedEvent): void => {
        this.resetDrag();
        this.redraw();
    };

    /** 创建一个拥有 Sprite 与透明度控制的池节点。 */
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

    /** 获取池中指定 Sprite，不足时按需扩容。 */
    private getPooledSpriteNode(root: Node, index: number): Node {
        while (root.children.length <= index) {
            this.createSpriteNode(root, `${root.name}_${root.children.length}`);
        }
        return root.children[index];
    }

    /** 隐藏指定层的全部池节点。 */
    private hidePooledSprites(root: Node | null): void {
        if (!root) return;
        for (let index = 0; index < root.children.length; index += 1) {
            root.children[index].active = false;
        }
    }

    /** 安全设置 SpriteFrame；资源缺失时隐藏格子，避免空白组件报错。 */
    private setSpriteFrame(node: Node, frame: SpriteFrame | null): void {
        const sprite = node.getComponent(Sprite);
        if (!sprite) return;
        sprite.spriteFrame = frame;
        node.active = frame !== null;
    }

    /** 按索引循环选择皮肤资源。 */
    private frameAt(frames: readonly SpriteFrame[], index: number): SpriteFrame | null {
        if (frames.length === 0) return null;
        return frames[Math.abs(index) % frames.length];
    }

    /** 设置自定义 Sprite 的正方形显示尺寸。 */
    private setSpriteSize(node: Node, size: number): void {
        node.getComponent(UITransform)?.setContentSize(size, size);
    }

    /** 计算方块占用的局部包围尺寸。 */
    private pieceBounds(cells: readonly { row: number; column: number }[]): { width: number; height: number } {
        let maxRow = 0;
        let maxColumn = 0;
        for (let index = 0; index < cells.length; index += 1) {
            maxRow = Math.max(maxRow, cells[index].row);
            maxColumn = Math.max(maxColumn, cells[index].column);
        }
        return { width: maxColumn + 1, height: maxRow + 1 };
    }

    /** 把触摸 UI 坐标转换到当前全屏节点的局部坐标。 */
    private touchToLocal(event: EventTouch): Vec3 {
        const location = event.getUILocation();
        return this.transform?.convertToNodeSpaceAR(new Vec3(location.x, location.y, 0)) ?? new Vec3();
    }

    /** 清理当前拖动和落点预览状态。 */
    private resetDrag(): void {
        this.draggingEntity = null;
        this.previewRow = -1;
        this.previewColumn = -1;
        this.previewValid = false;
    }
}
