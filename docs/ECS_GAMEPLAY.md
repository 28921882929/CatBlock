# CatBlock ECS 基础玩法开发说明

## 目标

本模块负责 8×8 方块放置、横纵消除、分数连击、三选方块刷新、无解结束和最高分保存。
ECS 只管理单局规则，资源、音频、UI 和全局状态继续使用项目现有管理器。

## 分层

- `config`：棋盘、方块形状和计分参数。
- `ecs/core`：实体、组件仓库、查询、系统、事件队列和命令缓冲区。
- `ecs/components`：单局纯数据组件。
- `ecs/systems`：按固定顺序处理单局规则。
- `logic`：不依赖 Cocos 的棋盘算法、随机生成和特殊格注册表。
- `view`：Cocos 输入和 Graphics 基础表现。
- `GameplayModule`：创建 World，并桥接 ECS 与现有管理器。

## 实体模型

每局只有一个 Session Entity，持有：

- `BoardComponent`
- `TrayComponent`
- `ScoreComponent`
- `GameSessionComponent`

待选区的三个方块分别使用 Piece Entity。方块落入棋盘后，数据写入棋盘数组并延迟销毁 Piece Entity。

棋盘格不拆成 64 个实体，以便连续扫描、原子消除和存档。

## 棋盘数据层

`BoardComponent` 使用相同索引的多组数组：

- `occupied`：是否被内容占用。
- `contentType`：普通块或特殊块类型。
- `terrainType`：不会随普通消除自动移除的地形。
- `value`：血量、倒计时、倍率等通用数值。
- `flags`：锁定、冰冻、不可摧毁等组合状态。
- `effectIds`：数据驱动特殊效果 ID。

这套结构允许“炸弹内容 + 冰层地形 + 锁定状态”等组合，不需要为每种组合增加新枚举。

## 系统顺序

系统注册顺序不可随意调整：

1. `PlacementSystem`
2. `LineDetectionSystem`
3. `LineClearSystem`
4. `SpecialEffectSystem`
5. `ScoreSystem`
6. `PieceGenerationSystem`
7. `GameOverSystem`

系统遍历期间创建、删除实体必须写入 `CommandBuffer`，当前逻辑帧结束后统一执行。

## 单次放置流程

1. View 调用 `GameplayModule.requestPlacement`。
2. `PlacementSystem` 验证边界和占用状态。
3. 合法方块写入棋盘，并从 Tray 移除。
4. `LineDetectionSystem` 一次找出全部完整横行和竖列。
5. `LineClearSystem` 对交叉格去重并清除内容层。
6. `SpecialEffectSystem` 在同帧按优先级处理特殊效果及连锁请求。
7. `ScoreSystem` 更新放置分、消除分、连击和最高分。
8. 三个方块用尽后生成下一组。
9. `GameOverSystem` 判断剩余方块是否全部无合法落点。

## 特殊格扩展

新增特殊格时：

1. 为内容类型分配稳定编号。
2. 在 `PieceCellConfig` 中配置 `effectId`、`value` 或 `flags`。
3. 实现 `SpecialCellDefinition`。
4. 通过 `GameplayModule.registerSpecialCell` 注册行为。
5. 在 View 中增加对应内容图标或覆盖层。
6. 为触发、连锁、计分和存档补充规则测试。

特殊效果通过 `SpecialEffectRequested` 进入队列。系统限制最大连锁深度为 16，单帧最多处理 256 个请求，防止错误配置造成死循环。

## 表现层替换

当前 `GameplayView` 使用 Graphics 绘制，不依赖外部美术资源，可直接验证玩法闭环。
正式美术接入时可以替换为棋盘和方块预制体，但不应修改 ECS 组件或规则算法。

## 编码约束

- 禁止使用 `for...of`。
- 高频遍历使用索引循环，非高频集合可以使用 `forEach`。
- Component 只保存数据，不实现业务行为。
- 纯逻辑模块不得引用 Cocos `Node` 或场景组件。
- ECS 内部使用 `GameEventQueue`，只在模块边界转发到 `EventBus`。
- 公开接口和关键流程必须使用中文 JSDoc。
- 魔法数字进入配置文件。
- 修改规则后必须运行纯逻辑测试、TypeScript 检查和 Cocos 构建。

## 验证命令

项目使用 Cocos Creator 3.8.8 自带的 TypeScript 编译器。规则测试位于：

```text
tests/gameplay-rules.test.ts
```

当前测试覆盖：

- 合法放置、越界和重叠检测
- 特殊格字段写入棋盘
- 横竖同时消除和交叉格去重
- 消除后保留地形层
- 无解判断
- ECS 延迟创建和销毁
- 放置、消除、计分完整系统流水线
