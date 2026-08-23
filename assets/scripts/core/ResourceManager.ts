import { Asset, resources } from 'cc';
import { Logger } from '../utils/Logger';

/** Cocos 资源类型的构造器签名。 */
type AssetConstructor<T extends Asset> = new (...args: any[]) => T;

/**
 * `resources` 目录资源的异步加载与引用计数管理器。
 *
 * 同一路径只保留一个已加载资源；不再使用时必须调用 `release`，
 * 应用退出时由 `releaseAll` 统一兜底释放。
 */
export class ResourceManager {
    private static readonly singleton = new ResourceManager();
    private readonly retainedAssets = new Map<string, Asset>();

    public static get instance(): ResourceManager {
        return this.singleton;
    }

    /**
     * 加载并持有指定资源。
     * @param path 相对于 `assets/resources` 的路径，不包含扩展名。
     * @param type 期望加载的 Cocos 资源类型。
     */
    public load<T extends Asset>(path: string, type: AssetConstructor<T>): Promise<T | null> {
        const cached = this.retainedAssets.get(path);
        if (cached instanceof type) return Promise.resolve(cached);

        return new Promise<T | null>((resolve) => {
            resources.load(path, type, (error, asset) => {
                if (error || !asset) {
                    Logger.error(`资源加载失败：${path}`, error);
                    resolve(null);
                    return;
                }
                asset.addRef();
                this.retainedAssets.set(path, asset);
                resolve(asset);
            });
        });
    }

    /** 释放指定路径对应的资源引用。 */
    public release(path: string): void {
        const asset = this.retainedAssets.get(path);
        if (!asset) return;
        asset.decRef();
        this.retainedAssets.delete(path);
    }

    /** 释放管理器当前持有的全部资源。 */
    public releaseAll(): void {
        this.retainedAssets.forEach((asset) => asset.decRef());
        this.retainedAssets.clear();
    }
}
