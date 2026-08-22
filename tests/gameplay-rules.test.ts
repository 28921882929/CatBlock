import { CellContentType, CellTerrainType } from '../assets/scripts/game/config/BoardConfig';
import type { PieceCellConfig } from '../assets/scripts/game/config/PieceConfig';
import { BoardComponentKey, createBoardComponent } from '../assets/scripts/game/ecs/components/BoardComponent';
import { GameSessionComponentKey } from '../assets/scripts/game/ecs/components/GameSessionComponent';
import { PieceComponentKey } from '../assets/scripts/game/ecs/components/PieceComponent';
import { PlacementComponentKey } from '../assets/scripts/game/ecs/components/PlacementComponent';
import { ScoreComponentKey } from '../assets/scripts/game/ecs/components/ScoreComponent';
import { TrayComponentKey } from '../assets/scripts/game/ecs/components/TrayComponent';
import { Query } from '../assets/scripts/game/ecs/core/Query';
import type { ComponentKey } from '../assets/scripts/game/ecs/core/Entity';
import { World } from '../assets/scripts/game/ecs/core/World';
import { LineClearSystem } from '../assets/scripts/game/ecs/systems/LineClearSystem';
import { LineDetectionSystem } from '../assets/scripts/game/ecs/systems/LineDetectionSystem';
import { PlacementSystem } from '../assets/scripts/game/ecs/systems/PlacementSystem';
import { ScoreSystem } from '../assets/scripts/game/ecs/systems/ScoreSystem';
import {
    canPlace,
    clearCells,
    findCompletedLines,
    hasAvailablePlacement,
    placePiece,
} from '../assets/scripts/game/logic/BoardRules';

/** 轻量断言，避免纯逻辑测试依赖第三方测试框架。 */
function assert(condition: boolean, message: string): void {
    if (!condition) throw new Error(`Assertion failed: ${message}`);
}

function normalCell(row: number, column: number): PieceCellConfig {
    return { row, column, contentType: CellContentType.Normal };
}

/** 验证放置边界、占用冲突和特殊格数据写入。 */
function testPlacementRules(): void {
    const board = createBoardComponent();
    const piece = {
        cells: [
            normalCell(0, 0),
            {
                row: 0,
                column: 1,
                contentType: CellContentType.Normal,
                terrainType: CellTerrainType.None,
                value: 2,
                effectId: 'bomb',
            },
        ],
    };

    assert(canPlace(board, piece, 0, 0), 'empty board should accept the piece');
    assert(!canPlace(board, piece, 0, 7), 'piece should not exceed the right edge');
    const indices = placePiece(board, piece, 0, 0);
    assert(indices.length === 2, 'two cells should be placed');
    assert(board.effectIds[1] === 'bomb', 'special effect id should be copied to board');
    assert(board.value[1] === 2, 'special value should be copied to board');
    assert(!canPlace(board, piece, 0, 0), 'occupied cells should reject overlapping piece');
}

/** 验证横竖同时消除时交叉格只出现一次。 */
function testLineDetectionAndClear(): void {
    const board = createBoardComponent();
    for (let column = 0; column < board.width; column += 1) {
        board.occupied[column] = 1;
        board.contentType[column] = CellContentType.Normal;
    }
    for (let row = 0; row < board.height; row += 1) {
        const index = row * board.width;
        board.occupied[index] = 1;
        board.contentType[index] = CellContentType.Normal;
    }
    board.terrainType[0] = 9;

    const completed = findCompletedLines(board);
    assert(completed.rows.length === 1 && completed.rows[0] === 0, 'top row should be complete');
    assert(completed.columns.length === 1 && completed.columns[0] === 0, 'left column should be complete');
    assert(completed.indices.length === 15, 'crossing lines should contain 15 unique cells');

    const cleared = clearCells(board, completed.indices);
    assert(cleared.length === 15, 'all occupied crossing cells should be captured');
    assert(board.occupied[0] === 0, 'cleared content should become empty');
    assert(board.terrainType[0] === 9, 'terrain layer should survive content clearing');
}

/** 验证无解检测同时考虑全部剩余方块。 */
function testAvailablePlacement(): void {
    const board = createBoardComponent();
    board.occupied.fill(1);
    const single = { cells: [normalCell(0, 0)] };
    assert(!hasAvailablePlacement(board, [single]), 'full board should have no valid placement');
    board.occupied[board.occupied.length - 1] = 0;
    assert(hasAvailablePlacement(board, [single]), 'one empty cell should fit a single block');
}

/** 验证查询和延迟结构变更不会污染当前遍历。 */
function testWorldLifecycle(): void {
    interface Marker { value: number }
    const markerKey = 'test.marker' as ComponentKey<Marker>;
    const world = new World();
    const first = world.createEntity();
    world.set(first, markerKey, { value: 1 });
    const deferred = world.deferCreate((target, entity) => target.set(entity, markerKey, { value: 2 }));
    assert(!world.isAlive(deferred), 'deferred entity should not be active before flush');
    world.update(0);
    assert(world.isAlive(deferred), 'deferred entity should activate after system phase');
    assert(world.query(new Query(markerKey)).length === 2, 'query should include both active entities');
    world.deferDestroy(first);
    world.update(0);
    assert(world.query(new Query(markerKey)).length === 1, 'deferred destroy should remove all components');
    world.destroy();
}

/** 验证放置、消除和计分系统能在同一逻辑帧完成基础闭环。 */
function testSystemPipeline(): void {
    const world = new World();
    world.addSystem(new PlacementSystem());
    world.addSystem(new LineDetectionSystem());
    world.addSystem(new LineClearSystem());
    world.addSystem(new ScoreSystem());

    const sessionEntity = world.createEntity();
    const board = createBoardComponent();
    for (let column = 0; column < board.width - 1; column += 1) {
        board.occupied[column] = 1;
        board.contentType[column] = CellContentType.Normal;
    }
    const pieceEntity = world.createEntity();
    world.set(pieceEntity, PieceComponentKey, {
        shapeId: 'single',
        cells: [normalCell(0, 0)],
        trayIndex: 0,
    });
    world.set(pieceEntity, PlacementComponentKey, { row: 0, column: board.width - 1 });
    world.set(sessionEntity, BoardComponentKey, board);
    world.set(sessionEntity, TrayComponentKey, { pieceEntities: [pieceEntity], round: 1 });
    world.set(sessionEntity, ScoreComponentKey, {
        score: 0,
        highScore: 0,
        combo: 0,
        totalClearedLines: 0,
    });
    world.set(sessionEntity, GameSessionComponentKey, {
        running: true,
        moveCount: 0,
        roundCount: 1,
    });

    world.update(0);
    const score = world.get(sessionEntity, ScoreComponentKey);
    assert(board.occupied[0] === 0, 'completed row should be cleared in the same frame');
    assert(score?.score === 11, 'single placement and one cleared line should award 11 points');
    assert(score?.combo === 1, 'successful clear should start combo at one');
    assert(!world.isAlive(pieceEntity), 'placed piece entity should be destroyed after commit');
    world.destroy();
}

testPlacementRules();
testLineDetectionAndClear();
testAvailablePlacement();
testWorldLifecycle();
testSystemPipeline();
console.log('Gameplay rules tests: OK');
