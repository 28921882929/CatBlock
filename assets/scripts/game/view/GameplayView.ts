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
    UITransform,
    Vec3,
    VerticalTextAlignment,
    view,
} from 'cc';
import { EventBus } from '../../core/EventBus';
import { GameManager } from '../../core/GameManager';
import { BoardConfig } from '../config/BoardConfig';
import type { Entity } from '../ecs/core/Entity';
import { GameplayEvents } from '../ecs/events/GameplayEvents';
import { GameplayModule } from '../GameplayModule';
import { GameEvents, GameState } from '../GameState';
import { canPlace } from '../logic/BoardRules';

const { ccclass } = _decorator;

interface TrayPieceBounds {
    readonly entity: Entity;
    readonly left: number;
    readonly right: number;
    readonly bottom: number;
    readonly top: number;
}

/**
 * 无外部美术资源的基础可玩表现层。
 * 使用 Graphics 绘制棋盘和方块，后续可替换成正式预制体而不修改 ECS 规则。
 */
@ccclass('GameplayView')
export class GameplayView extends Component {
    private graphics: Graphics | null = null;
    private statusLabel: Label | null = null;
    private transform: UITransform | null = null;
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

    protected onLoad(): void {
        const visibleSize = view.getVisibleSize();
        this.width = visibleSize.width;
        this.height = visibleSize.height;
        this.cellSize = Math.floor(Math.min((this.width - 32) / BoardConfig.width, (this.height - 250) / BoardConfig.height));
        this.boardLeft = -this.cellSize * BoardConfig.width * 0.5;
        this.boardTop = this.height * 0.5 - 82;
        this.trayY = this.boardTop - this.cellSize * BoardConfig.height - 72;

        this.transform = this.node.addComponent(UITransform);
        this.transform.setContentSize(this.width, this.height);
        this.graphics = this.node.addComponent(Graphics);
        this.createStatusLabel();
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
        label.color = new Color(52, 57, 66, 255);
        label.horizontalAlign = HorizontalTextAlignment.CENTER;
        label.verticalAlign = VerticalTextAlignment.CENTER;
        this.statusLabel = label;
    }

    /** 注册触摸输入。 */
    private registerInput(): void {
        this.node.on(Node.EventType.TOUCH_START, this.onTouchStart, this);
        this.node.on(Node.EventType.TOUCH_MOVE, this.onTouchMove, this);
        this.node.on(Node.EventType.TOUCH_END, this.onTouchEnd, this);
        this.node.on(Node.EventType.TOUCH_CANCEL, this.onTouchCancel, this);
    }

    /** 监听会改变棋盘或待选区显示的数据事件。 */
    private registerEvents(): void {
        EventBus.on(GameEvents.StateChanged, this.redraw, this);
        EventBus.on(GameplayEvents.PiecePlaced, this.redraw, this);
        EventBus.on(GameplayEvents.PlacementRejected, this.redraw, this);
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
            this.dragPosition.set(position.x, position.y + 70, 0);
            this.updatePreview();
            this.redraw();
            return;
        }
    }

    /** 更新拖动位置和棋盘预览原点。 */
    private onTouchMove(event: EventTouch): void {
        if (this.draggingEntity === null) return;
        const position = this.touchToLocal(event);
        this.dragPosition.set(position.x, position.y + 70, 0);
        this.updatePreview();
        this.redraw();
    }

    /** 松手后向 ECS 写入放置请求。 */
    private onTouchEnd(): void {
        if (this.draggingEntity === null) return;
        if (this.previewRow >= 0 && this.previewColumn >= 0) {
            GameplayModule.instance.requestPlacement(this.draggingEntity, this.previewRow, this.previewColumn);
        }
        this.resetDrag();
        this.redraw();
    }

    /** 触摸被系统取消时让方块返回待选区。 */
    private onTouchCancel(): void {
        this.resetDrag();
        this.redraw();
    }

    /** 根据拖动位置计算方块局部原点对应的棋盘行列。 */
    private updatePreview(): void {
        if (this.draggingEntity === null) return;
        const piece = GameplayModule.instance.getPiece(this.draggingEntity);
        if (!piece) return;
        const bounds = this.pieceBounds(piece.cells);
        const originX = this.dragPosition.x - bounds.width * this.cellSize * 0.5;
        const originY = this.dragPosition.y + bounds.height * this.cellSize * 0.5;
        this.previewColumn = Math.round((originX - this.boardLeft) / this.cellSize);
        this.previewRow = Math.round((this.boardTop - originY) / this.cellSize);
    }

    /** 绘制当前完整游戏状态。 */
    private redraw = (): void => {
        if (!this.graphics || !this.statusLabel) return;
        this.graphics.clear();
        this.drawBackground();

        const state = GameManager.instance.currentState;
        const score = GameplayModule.instance.getScore();
        if (state === GameState.Menu) {
            this.statusLabel.string = 'CatBlock\n点击任意位置开始';
            this.drawEmptyBoard();
            return;
        }

        this.statusLabel.string = state === GameState.GameOver
            ? `游戏结束  分数 ${score?.score ?? 0}  最高 ${score?.highScore ?? 0}\n点击重新开始`
            : `分数 ${score?.score ?? 0}   最高 ${score?.highScore ?? 0}   连击 ${score?.combo ?? 0}`;
        this.drawBoard();
        this.drawTray();
        this.drawDraggingPiece();
    };

    /** 绘制浅色全屏背景。 */
    private drawBackground(): void {
        if (!this.graphics) return;
        this.graphics.fillColor = new Color(242, 237, 226, 255);
        this.graphics.rect(-this.width * 0.5, -this.height * 0.5, this.width, this.height);
        this.graphics.fill();
    }

    /** 菜单状态下绘制空棋盘。 */
    private drawEmptyBoard(): void {
        this.drawGrid(null);
    }

    /** 绘制棋盘占用状态与拖动落点预览。 */
    private drawBoard(): void {
        this.drawGrid(GameplayModule.instance.getBoard());
        if (this.draggingEntity === null) return;
        const board = GameplayModule.instance.getBoard();
        const piece = GameplayModule.instance.getPiece(this.draggingEntity);
        if (!board || !piece) return;
        const valid = canPlace(board, piece, this.previewRow, this.previewColumn);
        const color = valid ? new Color(92, 190, 120, 135) : new Color(220, 80, 80, 120);
        this.drawPieceCells(piece.cells, this.boardLeft + this.previewColumn * this.cellSize, this.boardTop - this.previewRow * this.cellSize, this.cellSize, color);
    }

    /** 绘制棋盘底格和已占用内容。 */
    private drawGrid(board: ReturnType<GameplayModule['getBoard']>): void {
        if (!this.graphics) return;
        const gap = 3;
        for (let row = 0; row < BoardConfig.height; row += 1) {
            for (let column = 0; column < BoardConfig.width; column += 1) {
                const index = row * BoardConfig.width + column;
                const occupied = board ? board.occupied[index] !== 0 : false;
                this.graphics.fillColor = occupied
                    ? new Color(231, 148, 84, 255)
                    : new Color(214, 205, 188, 255);
                const x = this.boardLeft + column * this.cellSize + gap;
                const y = this.boardTop - (row + 1) * this.cellSize + gap;
                this.graphics.roundRect(x, y, this.cellSize - gap * 2, this.cellSize - gap * 2, 7);
                this.graphics.fill();
            }
        }
    }

    /** 绘制待选区剩余方块，并记录触摸命中区域。 */
    private drawTray(): void {
        const tray = GameplayModule.instance.getTray();
        this.trayBounds = [];
        if (!tray) return;
        const trayCellSize = Math.max(18, Math.floor(this.cellSize * 0.46));

        for (let index = 0; index < tray.pieceEntities.length; index += 1) {
            const entity = tray.pieceEntities[index];
            const piece = GameplayModule.instance.getPiece(entity);
            if (!piece || entity === this.draggingEntity) continue;
            const bounds = this.pieceBounds(piece.cells);
            const slotX = -this.width * 0.5 + this.width * (piece.trayIndex + 1) / 4;
            const left = slotX - bounds.width * trayCellSize * 0.5;
            const top = this.trayY + bounds.height * trayCellSize * 0.5;
            this.drawPieceCells(piece.cells, left, top, trayCellSize, new Color(225, 126, 68, 255));
            this.trayBounds.push({
                entity,
                left: left - 18,
                right: left + bounds.width * trayCellSize + 18,
                bottom: top - bounds.height * trayCellSize - 18,
                top: top + 18,
            });
        }
    }

    /** 绘制正在手指上方跟随移动的方块。 */
    private drawDraggingPiece(): void {
        if (this.draggingEntity === null) return;
        const piece = GameplayModule.instance.getPiece(this.draggingEntity);
        if (!piece) return;
        const bounds = this.pieceBounds(piece.cells);
        const left = this.dragPosition.x - bounds.width * this.cellSize * 0.5;
        const top = this.dragPosition.y + bounds.height * this.cellSize * 0.5;
        this.drawPieceCells(piece.cells, left, top, this.cellSize, new Color(238, 154, 82, 220));
    }

    /** 按方块局部坐标绘制全部组成格。 */
    private drawPieceCells(
        cells: readonly { row: number; column: number }[],
        left: number,
        top: number,
        size: number,
        color: Color,
    ): void {
        if (!this.graphics) return;
        const gap = Math.max(2, size * 0.06);
        this.graphics.fillColor = color;
        for (let index = 0; index < cells.length; index += 1) {
            const cell = cells[index];
            const x = left + cell.column * size + gap;
            const y = top - (cell.row + 1) * size + gap;
            this.graphics.roundRect(x, y, size - gap * 2, size - gap * 2, Math.max(3, size * 0.12));
            this.graphics.fill();
        }
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

    /** 清理当前拖动状态。 */
    private resetDrag(): void {
        this.draggingEntity = null;
        this.previewRow = -1;
        this.previewColumn = -1;
    }
}
