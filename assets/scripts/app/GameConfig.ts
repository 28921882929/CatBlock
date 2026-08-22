/**
 * 项目级静态配置。
 *
 * 这里只保存无需在运行时修改的默认值；玩家设置等可变数据应交由
 * `StorageManager` 持久化，避免不同职责的数据混在一起。
 */
export const GameConfig = Object.freeze({
    gameName: 'CatBlock',
    version: '0.1.0',
    storagePrefix: 'catblock',
    defaultMusicVolume: 0.8,
    defaultEffectVolume: 1,
    debug: true,
});
