import type { Entity } from './Entity';

/** 单一组件类型的数据仓库。 */
export class ComponentStore<T> {
    private readonly components = new Map<Entity, T>();

    /** 添加或覆盖实体上的组件。 */
    public set(entity: Entity, component: T): void {
        this.components.set(entity, component);
    }

    /** 获取组件；实体未持有该组件时返回 `undefined`。 */
    public get(entity: Entity): T | undefined {
        return this.components.get(entity);
    }

    /** 判断实体是否持有该组件。 */
    public has(entity: Entity): boolean {
        return this.components.has(entity);
    }

    /** 从实体移除该组件。 */
    public remove(entity: Entity): void {
        this.components.delete(entity);
    }

    /** 返回当前持有该组件的实体快照。 */
    public entities(): Entity[] {
        return Array.from(this.components.keys());
    }

    /** 清空该类型的全部组件。 */
    public clear(): void {
        this.components.clear();
    }
}
