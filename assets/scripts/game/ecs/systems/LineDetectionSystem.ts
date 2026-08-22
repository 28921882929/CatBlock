import { BoardComponentKey } from '../components/BoardComponent';
import type { System } from '../core/System';
import type { World } from '../core/World';
import { GameplayEvents, type LinesDetectedEvent, type PiecePlacedEvent } from '../events/GameplayEvents';
import { findCompletedLines } from '../../logic/BoardRules';

/** 在每次成功放置后一次性检测全部完整横行和竖列。 */
export class LineDetectionSystem implements System {
    public update(world: World): void {
        const placedEvents = world.events.read<PiecePlacedEvent>(GameplayEvents.PiecePlaced);
        for (let index = 0; index < placedEvents.length; index += 1) {
            const placed = placedEvents[index];
            const board = world.get(placed.sessionEntity, BoardComponentKey);
            if (!board) continue;
            const detected: LinesDetectedEvent = {
                sessionEntity: placed.sessionEntity,
                lines: findCompletedLines(board),
            };
            world.events.emit(GameplayEvents.LinesDetected, detected);
        }
    }
}
