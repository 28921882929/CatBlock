import type { ComponentKey } from '../core/Entity';

/** 由输入边界写入、等待 ECS 处理的一次放置请求。 */
export interface PlacementComponent {
    readonly row: number;
    readonly column: number;
}

export const PlacementComponentKey = 'game.placement' as ComponentKey<PlacementComponent>;
