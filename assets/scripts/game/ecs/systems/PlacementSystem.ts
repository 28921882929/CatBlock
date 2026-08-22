import { BoardComponentKey } from '../components/BoardComponent';
import { GameSessionComponentKey } from '../components/GameSessionComponent';
import { PieceComponentKey } from '../components/PieceComponent';
import { PlacementComponentKey } from '../components/PlacementComponent';
import { TrayComponentKey } from '../components/TrayComponent';
import { Query } from '../core/Query';
import type { System } from '../core/System';
import type { World } from '../core/World';
import { GameplayEvents, type PiecePlacedEvent, type PlacementRejectedEvent } from '../events/GameplayEvents';
import { canPlace, placePiece } from '../../logic/BoardRules';

/** 验证并提交外部输入产生的方块放置请求。 */
export class PlacementSystem implements System {
    private readonly pieceQuery = new Query(PieceComponentKey, PlacementComponentKey);
    private readonly sessionQuery = new Query(BoardComponentKey, TrayComponentKey, GameSessionComponentKey);

    public update(world: World): void {
        const sessionEntities = world.query(this.sessionQuery);
        if (sessionEntities.length === 0) return;
        const sessionEntity = sessionEntities[0];
        const board = world.get(sessionEntity, BoardComponentKey);
        const tray = world.get(sessionEntity, TrayComponentKey);
        const session = world.get(sessionEntity, GameSessionComponentKey);
        if (!board || !tray || !session?.running) return;

        const pieceEntities = world.query(this.pieceQuery);
        for (let index = 0; index < pieceEntities.length; index += 1) {
            const pieceEntity = pieceEntities[index];
            const piece = world.get(pieceEntity, PieceComponentKey);
            const placement = world.get(pieceEntity, PlacementComponentKey);
            if (!piece || !placement) continue;

            if (!canPlace(board, piece, placement.row, placement.column)) {
                const rejected: PlacementRejectedEvent = {
                    pieceEntity,
                    row: placement.row,
                    column: placement.column,
                };
                world.events.emit(GameplayEvents.PlacementRejected, rejected);
                world.commands.enqueue((targetWorld) => targetWorld.remove(pieceEntity, PlacementComponentKey));
                continue;
            }

            const placedIndices = placePiece(board, piece, placement.row, placement.column);
            const trayPosition = tray.pieceEntities.indexOf(pieceEntity);
            if (trayPosition >= 0) tray.pieceEntities.splice(trayPosition, 1);
            session.moveCount += 1;

            const placed: PiecePlacedEvent = {
                sessionEntity,
                pieceEntity,
                cellCount: piece.cells.length,
                placedIndices,
            };
            world.events.emit(GameplayEvents.PiecePlaced, placed);
            world.deferDestroy(pieceEntity);
        }
    }
}
