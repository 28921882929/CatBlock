import { Asset, resources } from 'cc';

type AssetConstructor<T extends Asset> = new (...args: any[]) => T;

export class ResourceManager {
    private static readonly singleton = new ResourceManager();
    private readonly retainedAssets = new Map<string, Asset>();

    public static get instance(): ResourceManager {
        return this.singleton;
    }

    public load<T extends Asset>(path: string, type: AssetConstructor<T>): Promise<T> {
        const cached = this.retainedAssets.get(path);
        if (cached instanceof type) return Promise.resolve(cached);

        return new Promise<T>((resolve, reject) => {
            resources.load(path, type, (error, asset) => {
                if (error) {
                    reject(error);
                    return;
                }
                asset.addRef();
                this.retainedAssets.set(path, asset);
                resolve(asset);
            });
        });
    }

    public release(path: string): void {
        const asset = this.retainedAssets.get(path);
        if (!asset) return;
        asset.decRef();
        this.retainedAssets.delete(path);
    }

    public releaseAll(): void {
        for (const asset of this.retainedAssets.values()) asset.decRef();
        this.retainedAssets.clear();
    }
}
