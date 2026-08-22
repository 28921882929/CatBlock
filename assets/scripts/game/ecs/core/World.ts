import { CommandBuffer } from './CommandBuffer';
import { ComponentStore } from './ComponentStore';
import type { ComponentKey, Entity } from './Entity';
import { GameEventQueue } from './GameEventQueue';
import { Query } from './Query';
import type { System } from './System';

/** 初始化延迟创建实体的回调。 */
export type DeferredEntityInitializer = (world: World, entity: Entity) => void;

/** ECS 单局运行容器。 */
export class World {
    public readonly commands = new CommandBuffer();
    public readonly events = new GameEventQueue();

    private nextEntity = 1;
    private readonly activeEntities = new Set<Entity>();
    private readonly stores = new Map<ComponentKey<unknown>, ComponentStore<unknown>>();
    private readonly systems: System[] = [];

    /** 立即创建实体，仅用于 World 初始化和外部输入边界。 */
    public createEntity(): Entity {
        const entity = this.reserveEntity();
        this.activeEntities.add(entity);
        return entity;
    }

    /** 延迟创建实体并返回预留 ID。 */
    public deferCreate(initializer: DeferredEntityInitializer): Entity {
        const entity = this.reserveEntity();
        this.commands.enqueue((world) => {
            world.activeEntities.add(entity);
            initializer(world, entity);
        });
        return entity;
    }

    /** 延迟销毁实体及其全部组件。 */
    public deferDestroy(entity: Entity): void {
        this.commands.enqueue((world) => world.destroyEntity(entity));
    }

    /** 判断实体是否已激活且尚未销毁。 */
    public isAlive(entity: Entity): boolean {
        return this.activeEntities.has(entity);
    }

    /** 为实体添加或覆盖组件。 */
    public set<T>(entity: Entity, key: ComponentKey<T>, component: T): void {
        this.store(key).set(entity, component);
    }

    /** 获取实体上的指定组件。 */
    public get<T>(entity: Entity, key: ComponentKey<T>): T | undefined {
        return this.store(key).get(entity);
    }

    /** 判断实体是否持有指定组件。 */
    public has<T>(entity: Entity, key: ComponentKey<T>): boolean {
        return this.store(key).has(entity);
    }

    /** 立即移除组件，仅用于不影响当前查询的外部边界。 */
    public remove<T>(entity: Entity, key: ComponentKey<T>): void {
        this.store(key).remove(entity);
    }

    /** 返回同时持有 Query 中全部组件的活动实体。 */
    public query(query: Query): Entity[] {
        if (query.keys.length === 0) return [];
        const candidates = this.store(query.keys[0]).entities();
        const result: Entity[] = [];

        for (let entityIndex = 0; entityIndex < candidates.length; entityIndex += 1) {
            const entity = candidates[entityIndex];
            if (!this.activeEntities.has(entity)) continue;

            let matches = true;
            for (let keyIndex = 1; keyIndex < query.keys.length; keyIndex += 1) {
                if (!this.store(query.keys[keyIndex]).has(entity)) {
                    matches = false;
                    break;
                }
            }
            if (matches) result.push(entity);
        }
        return result;
    }

    /** 注册系统，系统执行顺序与注册顺序一致。 */
    public addSystem(system: System): void {
        this.systems.push(system);
        system.initialize?.(this);
    }

    /** 执行一个逻辑帧，并在系统完成后应用结构变更。 */
    public update(deltaTime: number): void {
        this.events.clear();
        for (let index = 0; index < this.systems.length; index += 1) {
            this.systems[index].update(this, deltaTime);
        }
        this.commands.flush(this);
    }

    /** 销毁系统并清理 World 内的全部数据。 */
    public destroy(): void {
        for (let index = this.systems.length - 1; index >= 0; index -= 1) {
            this.systems[index].destroy?.(this);
        }
        this.commands.clear();
        this.events.clear();
        this.stores.forEach((store) => store.clear());
        this.stores.clear();
        this.activeEntities.clear();
        this.systems.length = 0;
    }

    /** 生成一个尚未激活的实体 ID。 */
    private reserveEntity(): Entity {
        const entity = this.nextEntity;
        this.nextEntity += 1;
        return entity;
    }

    /** 立即销毁实体；仅允许由命令缓冲区调用。 */
    private destroyEntity(entity: Entity): void {
        if (!this.activeEntities.delete(entity)) return;
        this.stores.forEach((store) => store.remove(entity));
    }

    /** 获取组件仓库，不存在时按需创建。 */
    private store<T>(key: ComponentKey<T>): ComponentStore<T> {
        let store = this.stores.get(key as ComponentKey<unknown>) as ComponentStore<T> | undefined;
        if (!store) {
            store = new ComponentStore<T>();
            this.stores.set(key as ComponentKey<unknown>, store as ComponentStore<unknown>);
        }
        return store;
    }
}
