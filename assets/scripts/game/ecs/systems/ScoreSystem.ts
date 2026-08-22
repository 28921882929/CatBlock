import { ScoreConfig } from '../../config/ScoreConfig';
import { ScoreComponentKey } from '../components/ScoreComponent';
import type { System } from '../core/System';
import type { World } from '../core/World';
import {
    GameplayEvents,
    type MoveResolvedEvent,
    type PiecePlacedEvent,
    type ScoreChangedEvent,
} from '../events/GameplayEvents';

/** 根据落子、消除和连击统一计算分数。 */
export class ScoreSystem implements System {
    public update(world: World): void {
        const placedEvents = world.events.read<PiecePlacedEvent>(GameplayEvents.PiecePlaced);
        const resolvedEvents = world.events.read<MoveResolvedEvent>(GameplayEvents.MoveResolved);

        for (let index = 0; index < placedEvents.length; index += 1) {
            const event = placedEvents[index];
            const score = world.get(event.sessionEntity, ScoreComponentKey);
            if (!score) continue;
            score.score += event.cellCount * ScoreConfig.scorePerPlacedCell;
        }

        for (let index = 0; index < resolvedEvents.length; index += 1) {
            const event = resolvedEvents[index];
            const score = world.get(event.sessionEntity, ScoreComponentKey);
            if (!score) continue;

            if (event.lineCount > 0) {
                score.combo += 1;
                const multiplierIndex = Math.min(score.combo - 1, ScoreConfig.comboMultipliers.length - 1);
                const multiplier = ScoreConfig.comboMultipliers[multiplierIndex];
                const lineScore = ScoreConfig.scorePerClearedLine * event.lineCount * event.lineCount;
                score.score += Math.round(lineScore * multiplier);
                score.totalClearedLines += event.lineCount;
            } else {
                score.combo = 0;
            }

            score.highScore = Math.max(score.highScore, score.score);
            const changed: ScoreChangedEvent = {
                score: score.score,
                highScore: score.highScore,
                combo: score.combo,
            };
            world.events.emit(GameplayEvents.ScoreChanged, changed);
        }
    }
}
