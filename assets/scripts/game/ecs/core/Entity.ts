/** ECS 实体 ID。实体本身不保存任何业务数据。 */
export type Entity = number;

/**
 * 带组件类型提示的唯一字符串键。
 * 运行时仍是普通字符串，泛型只用于编译期约束。
 */
export type ComponentKey<T> = string & { readonly __componentType?: T };
