import { instantiate, Node, Prefab } from 'cc';
import { ResourceManager } from '../core/ResourceManager';
import { BaseView } from './BaseView';

/**
 * UI 注册、实例化和生命周期管理器。
 *
 * 页面预制体必须放在 `assets/resources` 下，并通过 `register` 建立名称
 * 与路径的映射。已打开页面默认复用，避免频繁创建节点。
 */
export class UIManager {
    private static readonly singleton = new UIManager();
    private readonly paths = new Map<string, string>();
    private readonly opened = new Map<string, Node>();
    private root: Node | null = null;

    public static get instance(): UIManager {
        return this.singleton;
    }

    /** 设置全部 UI 页面的父节点。 */
    public initialize(root: Node): void {
        this.root = root;
    }

    /** 注册页面名称和 resources 相对路径。 */
    public register(name: string, resourcePath: string): void {
        this.paths.set(name, resourcePath);
    }

    /**
     * 打开页面；已存在的页面会被重新激活，否则异步加载并实例化预制体。
     * @param name 注册时使用的页面名称。
     * @param data 传递给页面 `onOpen` 的可选业务数据。
     */
    public async open(name: string, data?: unknown): Promise<Node> {
        const existing = this.opened.get(name);
        if (existing?.isValid) {
            existing.active = true;
            existing.getComponent(BaseView)?.onOpen(data);
            return existing;
        }

        if (!this.root) throw new Error('UIManager is not initialized');
        const path = this.paths.get(name);
        if (!path) throw new Error(`UI is not registered: ${name}`);

        const prefab = await ResourceManager.instance.load(path, Prefab);
        const node = instantiate(prefab);
        node.name = name;
        this.root.addChild(node);
        this.opened.set(name, node);
        node.getComponent(BaseView)?.onOpen(data);
        return node;
    }

    /**
     * 关闭页面。
     * @param destroy 为 `true` 时销毁节点，否则仅隐藏以供下次复用。
     */
    public close(name: string, destroy = false): void {
        const node = this.opened.get(name);
        if (!node) return;

        node.getComponent(BaseView)?.onClose();
        if (destroy) {
            node.destroy();
            this.opened.delete(name);
        } else {
            node.active = false;
        }
    }

    /** 关闭当前管理的全部页面。 */
    public closeAll(destroy = false): void {
        const names = Array.from(this.opened.keys());
        names.forEach((name) => this.close(name, destroy));
    }
}
