import { PieceConfigs, type PieceShapeConfig } from '../config/PieceConfig';
import { Logger } from '../../utils/Logger';

/** 返回 0（含）到 1（不含）的随机函数。 */
export type RandomSource = () => number;

/** 基于轮次和权重生成方块，支持注入随机源以便测试复现。 */
export class RandomPieceGenerator {
    public constructor(
        private readonly random: RandomSource = Math.random,
        private readonly configs: readonly PieceShapeConfig[] = PieceConfigs,
    ) {}

    /** 从当前轮次允许出现的配置中抽取一个方块。 */
    public next(round: number): PieceShapeConfig | null {
        const available = this.configs.filter((config) => (config.minRound ?? 0) <= round);
        if (available.length === 0) {
            Logger.error(`第 ${round} 轮没有可用的方块配置，已取消本轮生成`);
            return null;
        }

        let totalWeight = 0;
        available.forEach((config) => {
            totalWeight += Math.max(0, config.weight);
        });
        if (totalWeight <= 0) return available[0];

        let target = this.random() * totalWeight;
        for (let index = 0; index < available.length; index += 1) {
            target -= Math.max(0, available[index].weight);
            if (target < 0) return available[index];
        }
        return available[available.length - 1];
    }
}
