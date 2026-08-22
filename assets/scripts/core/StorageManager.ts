import { sys } from 'cc';
import { GameConfig } from '../app/GameConfig';
import { Logger } from '../utils/Logger';

export class StorageManager {
    private static readonly singleton = new StorageManager();

    public static get instance(): StorageManager {
        return this.singleton;
    }

    public set<T>(key: string, value: T): boolean {
        try {
            sys.localStorage.setItem(this.key(key), JSON.stringify(value));
            return true;
        } catch (error) {
            Logger.error(`Failed to save ${key}`, error);
            return false;
        }
    }

    public get<T>(key: string, fallback: T): T {
        try {
            const rawValue = sys.localStorage.getItem(this.key(key));
            return rawValue === null ? fallback : JSON.parse(rawValue) as T;
        } catch (error) {
            Logger.warn(`Failed to read ${key}`, error);
            return fallback;
        }
    }

    public remove(key: string): void {
        sys.localStorage.removeItem(this.key(key));
    }

    private key(key: string): string {
        return `${GameConfig.storagePrefix}:${key}`;
    }
}
