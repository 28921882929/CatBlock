import type { World } from './World';

/** ECS 系统统一生命周期。 */
export interface System {
    /** 系统加入 World 后执行一次。 */
    initialize?(world: World): void;

    /** 按 World 中的注册顺序逐帧执行。 */
    update(world: World, deltaTime: number): void;

    /** World 销毁前执行一次。 */
    destroy?(world: World): void;
}
