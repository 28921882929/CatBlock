import { GameConfig } from '../app/GameConfig';

/**
 * 统一日志入口，为日志增加项目名前缀，并集中控制调试日志开关。
 */
export class Logger {
    /** 仅在调试模式开启时输出普通日志。 */
    public static log(message: string, ...details: unknown[]): void {
        if (GameConfig.debug) {
            console.log(`[${GameConfig.gameName}] ${message}`, ...details);
        }
    }

    /** 输出需要开发者关注、但不阻断流程的警告。 */
    public static warn(message: string, ...details: unknown[]): void {
        console.warn(`[${GameConfig.gameName}] ${message}`, ...details);
    }

    /** 输出已经导致功能失败的错误。 */
    public static error(message: string, ...details: unknown[]): void {
        console.error(`[${GameConfig.gameName}] ${message}`, ...details);
    }
}
