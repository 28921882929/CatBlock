import { GameConfig } from '../app/GameConfig';

export class Logger {
    public static log(message: string, ...details: unknown[]): void {
        if (GameConfig.debug) {
            console.log(`[${GameConfig.gameName}] ${message}`, ...details);
        }
    }

    public static warn(message: string, ...details: unknown[]): void {
        console.warn(`[${GameConfig.gameName}] ${message}`, ...details);
    }

    public static error(message: string, ...details: unknown[]): void {
        console.error(`[${GameConfig.gameName}] ${message}`, ...details);
    }
}
