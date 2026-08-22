import { BoardComponentKey } from '../components/BoardComponent';
import type { System } from '../core/System';
import type { World } from '../core/World';
import { GameplayEvents, type LinesDetectedEvent, type MoveResolvedEvent } from '../events/GameplayEvents';
import { clearCells } from '../../logic/BoardRules';
import { CellTrigger } from '../../logic/special/SpecialCellRegistry';
import type { SpecialEffectRequest } from '../../logic/special/SpecialEffectRequest';

/** 清除检测到的行列，并为特殊格生成后续效果请求。 */
export class LineClearSystem implements System {
    public update(world: World): void {
        const detectedEvents = world.events.read<LinesDetectedEvent>(GameplayEvents.LinesDetected);
        for (let index = 0; index < detectedEvents.length; index += 1) {
            const detected = detectedEvents[index];
            const board = world.get(detected.sessionEntity, BoardComponentKey);
            if (!board) continue;

            const clearedCells = clearCells(board, detected.lines.indices);
            for (let cellIndex = 0; cellIndex < clearedCells.length; cellIndex += 1) {
                const cell = clearedCells[cellIndex];
                if (cell.effectId.length === 0) continue;
                const request: SpecialEffectRequest = {
                    effectId: cell.effectId,
                    sourceIndex: cell.index,
                    trigger: CellTrigger.OnCleared,
                    priority: 0,
                    chainDepth: 0,
                };
                world.events.emit(GameplayEvents.SpecialEffectRequested, request);
            }

            const resolved: MoveResolvedEvent = {
                sessionEntity: detected.sessionEntity,
                lineCount: detected.lines.rows.length + detected.lines.columns.length,
                clearedCells,
            };
            world.events.emit(GameplayEvents.MoveResolved, resolved);
        }
    }
}
