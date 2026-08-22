import type { ComponentKey } from './Entity';

/** 描述一组必须同时存在的组件条件。 */
export class Query {
    public readonly keys: readonly ComponentKey<unknown>[];

    public constructor(...keys: ComponentKey<unknown>[]) {
        this.keys = keys;
    }
}
