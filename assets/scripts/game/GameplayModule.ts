import { EventBus } from '../core/EventBus';
import { GameManager } from '../core/GameManager';
import { StorageManager } from '../core/StorageManager';
import { GameState } from './GameState';
import { createBoardComponent, BoardComponentKey, type BoardComponent } from './ecs/components/BoardComponent';
import { GameSessionComponentKey, type GameSessionComponent } from './ecs/components/GameSessionComponent';
import { PieceComponentKey, type PieceComponent } from './ecs/components/PieceComponent';
import { PlacementComponentKey } from './ecs/components/PlacementComponent';
import { ScoreComponentKey, type ScoreComponent } from './ecs/components/ScoreComponent';
import { TrayComponentKey, type TrayComponent } from './ecs/components/TrayComponent';
import type { Entity } from './ecs/core/Entity';
import { World } from './ecs/core/World';
import {
    GameplayEvents,
    type GameOverEvent,
    type MoveResolvedEvent,
    type PiecePlacedEvent,
    type PlacementRejectedEvent,
    type ScoreChangedEvent,
    type TrayRefilledEvent,
} from './ecs/events/GameplayEvents';
import { RandomPieceGenerator, type RandomSource } from './logic/RandomPieceGenerator';
import { SpecialCellRegistry, type SpecialCellDefinition } from './logic/special/SpecialCellRegistry';
import { GameOverSystem } from './ecs/systems/GameOverSystem';
import { LineClearSystem } from './ecs/systems/LineClearSystem';
import { LineDetectionSystem } from './ecs/systems/LineDetectionSystem';
import { PieceGenerationSystem } from './ecs/systems/PieceGenerationSystem';
import { PlacementSystem } from './ecs/systems/PlacementSystem';
import { ScoreSystem } from './ecs/systems/ScoreSystem';
import { SpecialEffectSystem } from './ecs/systems/SpecialEffectSystem';

/** 玩家跨单局保存的统计数据。 */
export interface PlayerRecord {
    highScore: number;
    totalGames: number;
    totalClearedLines: number;
}

const PLAYER_RECORD_KEY = 'player-record';
const EMPTY_RECORD: Readonly<PlayerRecord> = Object.freeze({
    highScore: 0,
    totalGames: 0,
    totalClearedLines: 0,
});

/** 将本地存储中的未知字段收敛为可安全使用的非负整数。 */
function normalizeRecordNumber(value: unknown): number {
    return typeof value === 'number' && Number.isFinite(value) ? Math.max(0, Math.floor(value)) : 0;
}

/**
 * ECS 单局玩法的外围门面。
 * Cocos 输入与表现层只调用本类，不直接访问具体 System。
 */
export class GameplayModule {
    private static readonly singleton = new GameplayModule();
    private readonly specialCells = new SpecialCellRegistry();
    private world: World | null = null;
    private sessionEntity: Entity | null = null;
    private randomSource: RandomSource = Math.random;

    public static get instance(): GameplayModule {
        return this.singleton;
    }

    /** 注入随机源；主要用于可复现测试。 */
    public setRandomSource(random: RandomSource): void {
        this.randomSource = random;
    }

    /** 注册一个数据驱动的特殊格行为。建议在创建单局前完成注册。 */
    public registerSpecialCell(definition: SpecialCellDefinition): void {
        this.specialCells.register(definition);
    }

    /** 创建一局全新的游戏，并立即生成首批三个方块。 */
    public startSession(): void {
        this.destroySession();
        const record = this.getPlayerRecord();
        this.world = this.createWorld();
        this.sessionEntity = this.world.createEntity();
        this.world.set(this.sessionEntity, BoardComponentKey, createBoardComponent());
        this.world.set(this.sessionEntity, TrayComponentKey, { pieceEntities: [], round: 0 });
        this.world.set(this.sessionEntity, ScoreComponentKey, {
            score: 0,
            highScore: record.highScore,
            combo: 0,
            totalClearedLines: 0,
        });
        this.world.set(this.sessionEntity, GameSessionComponentKey, {
            running: true,
            moveCount: 0,
            roundCount: 0,
        });
        this.update(0);
    }

    /** 执行 ECS 逻辑帧并把领域事件桥接到外围 EventBus。 */
    public update(deltaTime: number): void {
        if (!this.world) return;
        this.world.update(deltaTime);
        this.bridgeEvents(this.world);
    }

    /**
     * 请求放置一个待选方块。
     * 返回值只表示请求是否成功写入，最终合法性由 PlacementSystem 判断。
     */
    public requestPlacement(pieceEntity: Entity, row: number, column: number): boolean {
        if (!this.world || !this.world.isAlive(pieceEntity)) return false;
        if (!this.world.has(pieceEntity, PieceComponentKey)) return false;
        if (this.world.has(pieceEntity, PlacementComponentKey)) return false;
        this.world.set(pieceEntity, PlacementComponentKey, { row, column });
        return true;
    }

    /** 返回当前棋盘的只读引用，供表现层同步。 */
    public getBoard(): BoardComponent | null {
        return this.getSessionComponent(BoardComponentKey);
    }

    /** 返回当前待选区数据。 */
    public getTray(): TrayComponent | null {
        return this.getSessionComponent(TrayComponentKey);
    }

    /** 返回指定方块实体数据。 */
    public getPiece(entity: Entity): PieceComponent | null {
        return this.world?.get(entity, PieceComponentKey) ?? null;
    }

    /** 返回当前分数数据。 */
    public getScore(): ScoreComponent | null {
        return this.getSessionComponent(ScoreComponentKey);
    }

    /** 返回当前单局状态。 */
    public getSession(): GameSessionComponent | null {
        return this.getSessionComponent(GameSessionComponentKey);
    }

    /** 返回跨单局保存的玩家记录，供菜单和结算界面展示。 */
    public getPlayerRecord(): PlayerRecord {
        const storedValue = StorageManager.instance.get<unknown>(PLAYER_RECORD_KEY, EMPTY_RECORD);
        const stored = storedValue && typeof storedValue === 'object'
            ? storedValue as Partial<PlayerRecord>
            : EMPTY_RECORD;
        return {
            highScore: normalizeRecordNumber(stored.highScore),
            totalGames: normalizeRecordNumber(stored.totalGames),
            totalClearedLines: normalizeRecordNumber(stored.totalClearedLines),
        };
    }

    /** 销毁当前单局，但保留特殊格注册表。 */
    public destroySession(): void {
        this.world?.destroy();
        this.world = null;
        this.sessionEntity = null;
    }

    /** 销毁整个玩法模块。 */
    public destroy(): void {
        this.destroySession();
        this.specialCells.clear();
    }

    /** 按文档约定的顺序组装全部基础玩法系统。 */
    private createWorld(): World {
        const world = new World();
        world.addSystem(new PlacementSystem());
        world.addSystem(new LineDetectionSystem());
        world.addSystem(new LineClearSystem());
        world.addSystem(new SpecialEffectSystem(this.specialCells));
        world.addSystem(new ScoreSystem());
        world.addSystem(new PieceGenerationSystem(new RandomPieceGenerator(this.randomSource)));
        world.addSystem(new GameOverSystem());
        return world;
    }

    /** 将 ECS 单帧事件转发给 UI、音频和全局流程管理器。 */
    private bridgeEvents(world: World): void {
        this.emitAll<PiecePlacedEvent>(world, GameplayEvents.PiecePlaced);
        this.emitAll<PlacementRejectedEvent>(world, GameplayEvents.PlacementRejected);
        this.emitAll<MoveResolvedEvent>(world, GameplayEvents.MoveResolved);
        const scoreEvents = world.events.read<ScoreChangedEvent>(GameplayEvents.ScoreChanged);
        for (let index = 0; index < scoreEvents.length; index += 1) {
            const event = scoreEvents[index];
            this.saveHighScore(event.highScore);
            EventBus.emit(GameplayEvents.ScoreChanged, event);
        }
        this.emitAll<TrayRefilledEvent>(world, GameplayEvents.TrayRefilled);

        const gameOverEvents = world.events.read<GameOverEvent>(GameplayEvents.GameOver);
        for (let index = 0; index < gameOverEvents.length; index += 1) {
            const event = gameOverEvents[index];
            this.saveRecord();
            EventBus.emit(GameplayEvents.GameOver, event);
            GameManager.instance.changeState(GameState.GameOver);
        }
    }

    /** 转发指定类型的全部 ECS 事件。 */
    private emitAll<T>(world: World, type: string): void {
        const events = world.events.read<T>(type);
        for (let index = 0; index < events.length; index += 1) {
            EventBus.emit(type, events[index]);
        }
    }

    /** 游戏结束时合并并保存玩家统计。 */
    private saveRecord(): void {
        const score = this.getScore();
        if (!score) return;
        const record = this.getPlayerRecord();
        record.highScore = Math.max(record.highScore, score.highScore);
        record.totalGames += 1;
        record.totalClearedLines += score.totalClearedLines;
        StorageManager.instance.set(PLAYER_RECORD_KEY, record);
    }

    /** 新纪录产生时立即落盘，避免刷新或关闭页面导致最高分丢失。 */
    private saveHighScore(highScore: number): void {
        const record = this.getPlayerRecord();
        if (highScore <= record.highScore) return;
        record.highScore = highScore;
        StorageManager.instance.set(PLAYER_RECORD_KEY, record);
    }

    /** 获取当前单局实体上的组件。 */
    private getSessionComponent<T>(key: import('./ecs/core/Entity').ComponentKey<T>): T | null {
        if (!this.world || this.sessionEntity === null) return null;
        return this.world.get(this.sessionEntity, key) ?? null;
    }
}
