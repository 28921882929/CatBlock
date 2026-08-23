import { GameSessionComponentKey } from '../components/GameSessionComponent';
import { PieceComponentKey, type PieceComponent } from '../components/PieceComponent';
import { TrayComponentKey } from '../components/TrayComponent';
import { Query } from '../core/Query';
import type { System } from '../core/System';
import type { World } from '../core/World';
import { GameplayEvents, type TrayRefilledEvent } from '../events/GameplayEvents';
import { RandomPieceGenerator } from '../../logic/RandomPieceGenerator';

/** 当前三个方块用尽后，延迟创建下一轮方块实体。 */
export class PieceGenerationSystem implements System {
    private readonly sessionQuery = new Query(TrayComponentKey, GameSessionComponentKey);

    public constructor(private readonly generator: RandomPieceGenerator) {}

    public update(world: World): void {
        const sessionEntities = world.query(this.sessionQuery);
        for (let sessionIndex = 0; sessionIndex < sessionEntities.length; sessionIndex += 1) {
            const sessionEntity = sessionEntities[sessionIndex];
            const tray = world.get(sessionEntity, TrayComponentKey);
            const session = world.get(sessionEntity, GameSessionComponentKey);
            if (!tray || !session?.running || tray.pieceEntities.length > 0) continue;

            tray.round += 1;
            session.roundCount = tray.round;
            // 先完成整组配置抽取，任意配置缺失时停止会话，避免生成不完整的待选区。
            const shapes = Array.from({ length: 3 }, () => this.generator.next(tray.round));
            if (shapes.some((shape) => shape === null)) {
                session.running = false;
                continue;
            }

            const generatedEntities: number[] = [];
            for (let trayIndex = 0; trayIndex < 3; trayIndex += 1) {
                const shape = shapes[trayIndex];
                if (!shape) continue;
                const entity = world.deferCreate((targetWorld, createdEntity) => {
                    const piece: PieceComponent = {
                        shapeId: shape.id,
                        cells: shape.cells,
                        trayIndex,
                        visualStyle: (tray.round * 3 + trayIndex - 3) % 10,
                    };
                    targetWorld.set(createdEntity, PieceComponentKey, piece);
                });
                generatedEntities.push(entity);
            }
            tray.pieceEntities = generatedEntities;
            const refilled: TrayRefilledEvent = {
                round: tray.round,
                pieceEntities: generatedEntities.slice(),
            };
            world.events.emit(GameplayEvents.TrayRefilled, refilled);
        }
    }
}
