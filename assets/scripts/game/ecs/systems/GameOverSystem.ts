import { BoardComponentKey } from '../components/BoardComponent';
import { GameSessionComponentKey } from '../components/GameSessionComponent';
import { PieceComponentKey, type PieceComponent } from '../components/PieceComponent';
import { ScoreComponentKey } from '../components/ScoreComponent';
import { TrayComponentKey } from '../components/TrayComponent';
import { Query } from '../core/Query';
import type { System } from '../core/System';
import type { World } from '../core/World';
import { GameplayEvents, type GameOverEvent } from '../events/GameplayEvents';
import { hasAvailablePlacement } from '../../logic/BoardRules';

/** 判断剩余方块是否全部无合法落点。 */
export class GameOverSystem implements System {
    private readonly sessionQuery = new Query(
        BoardComponentKey,
        TrayComponentKey,
        ScoreComponentKey,
        GameSessionComponentKey,
    );

    public update(world: World): void {
        const sessionEntities = world.query(this.sessionQuery);
        for (let sessionIndex = 0; sessionIndex < sessionEntities.length; sessionIndex += 1) {
            const sessionEntity = sessionEntities[sessionIndex];
            const board = world.get(sessionEntity, BoardComponentKey);
            const tray = world.get(sessionEntity, TrayComponentKey);
            const score = world.get(sessionEntity, ScoreComponentKey);
            const session = world.get(sessionEntity, GameSessionComponentKey);
            if (!board || !tray || !score || !session?.running || tray.pieceEntities.length === 0) continue;

            const pieces: PieceComponent[] = [];
            let generationPending = false;
            for (let index = 0; index < tray.pieceEntities.length; index += 1) {
                const pieceEntity = tray.pieceEntities[index];
                const piece = world.get(pieceEntity, PieceComponentKey);
                if (!piece) {
                    generationPending = true;
                    break;
                }
                pieces.push(piece);
            }
            if (generationPending || hasAvailablePlacement(board, pieces)) continue;

            session.running = false;
            const gameOver: GameOverEvent = { score: score.score, highScore: score.highScore };
            world.events.emit(GameplayEvents.GameOver, gameOver);
        }
    }
}
