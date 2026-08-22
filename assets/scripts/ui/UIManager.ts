import { instantiate, Node, Prefab } from 'cc';
import { ResourceManager } from '../core/ResourceManager';
import { BaseView } from './BaseView';

export class UIManager {
    private static readonly singleton = new UIManager();
    private readonly paths = new Map<string, string>();
    private readonly opened = new Map<string, Node>();
    private root: Node | null = null;

    public static get instance(): UIManager {
        return this.singleton;
    }

    public initialize(root: Node): void {
        this.root = root;
    }

    public register(name: string, resourcePath: string): void {
        this.paths.set(name, resourcePath);
    }

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

    public closeAll(destroy = false): void {
        for (const name of [...this.opened.keys()]) this.close(name, destroy);
    }
}
