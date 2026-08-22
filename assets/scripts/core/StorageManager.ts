import { sys } from 'cc';
import { GameConfig } from '../app/GameConfig';
import { Logger } from '../utils/Logger';

/**
 * 本地 JSON 数据持久化入口。
 * 所有键都会自动添加项目命名空间，避免与同域名下其他游戏冲突。
 */
export class StorageManager {
    private static readonly singleton = new StorageManager();

    public static get instance(): StorageManager {
        return this.singleton;
    }

    /** 序列化并保存数据，返回本次写入是否成功。 */
    public set<T>(key: string, value: T): boolean {
        try {
            sys.localStorage.setItem(this.key(key), JSON.stringify(value));
            return true;
        } catch (error) {
            Logger.error(`Failed to save ${key}`, error);
            return false;
        }
    }

    /** 读取并反序列化数据，数据不存在或损坏时返回传入的默认值。 */
    public get<T>(key: string, fallback: T): T {
        try {
            const rawValue = sys.localStorage.getItem(this.key(key));
            return rawValue === null ? fallback : JSON.parse(rawValue) as T;
        } catch (error) {
            Logger.warn(`Failed to read ${key}`, error);
            return fallback;
        }
    }

    /** 删除指定键保存的数据。 */
    public remove(key: string): void {
        sys.localStorage.removeItem(this.key(key));
    }

    /** 生成带项目命名空间的最终存储键。 */
    private key(key: string): string {
        return `${GameConfig.storagePrefix}:${key}`;
    }
}
