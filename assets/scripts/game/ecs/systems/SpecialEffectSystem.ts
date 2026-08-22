import { BoardComponentKey } from '../components/BoardComponent';
import { GameSessionComponentKey } from '../components/GameSessionComponent';
import { Query } from '../core/Query';
import type { System } from '../core/System';
import type { World } from '../core/World';
import { GameplayEvents } from '../events/GameplayEvents';
import type { SpecialEffectRequest } from '../../logic/special/SpecialEffectRequest';
import { SpecialCellRegistry } from '../../logic/special/SpecialCellRegistry';

/** 按优先级结算特殊格效果，并限制连锁深度。 */
export class SpecialEffectSystem implements System {
    private readonly sessionQuery = new Query(BoardComponentKey, GameSessionComponentKey);

    public constructor(
        private readonly registry: SpecialCellRegistry,
        private readonly maxChainDepth = 16,
    ) {}

    public update(world: World): void {
        const sessionEntities = world.query(this.sessionQuery);
        if (sessionEntities.length === 0) return;
        const board = world.get(sessionEntities[0], BoardComponentKey);
        if (!board) return;

        const pending: SpecialEffectRequest[] = [];
        let observedCount = 0;
        let processedCount = 0;

        // 每次效果执行后重新收集新请求，使连锁反应在同一逻辑帧内结算完毕。
        while (processedCount < 256) {
            const allRequests = world.events.read<SpecialEffectRequest>(GameplayEvents.SpecialEffectRequested);
            for (let index = observedCount; index < allRequests.length; index += 1) {
                pending.push(allRequests[index]);
            }
            observedCount = allRequests.length;
            if (pending.length === 0) break;

            pending.sort((left, right) => {
                const leftPriority = this.registry.get(left.effectId)?.priority ?? left.priority;
                const rightPriority = this.registry.get(right.effectId)?.priority ?? right.priority;
                return rightPriority - leftPriority;
            });
            const request = pending.splice(0, 1)[0];
            processedCount += 1;
            if (request.chainDepth > this.maxChainDepth) continue;
            const definition = this.registry.get(request.effectId);
            if (!definition || definition.trigger !== request.trigger) continue;
            definition.resolve({
                board,
                sourceIndex: request.sourceIndex,
                chainDepth: request.chainDepth,
                events: world.events,
            });
        }
    }
}
