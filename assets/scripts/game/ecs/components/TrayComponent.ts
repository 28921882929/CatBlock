import type { ComponentKey, Entity } from '../core/Entity';

/** 当前一轮待放置的三个方块实体。 */
export interface TrayComponent {
    pieceEntities: Entity[];
    round: number;
}

export const TrayComponentKey = 'game.tray' as ComponentKey<TrayComponent>;
