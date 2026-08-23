# CatBlock UI 拆分资源说明

本目录中的资源由主参考图 `docs/art/catblock-main-art-reference.png` 拆分与重绘而来，统一遵循 `docs/ART_STYLE.md`。背景图为不透明 PNG，其余资源均带真实 Alpha 通道，可直接导入 Cocos Creator 作为 `SpriteFrame` 使用。

## 目录与用途

### `background/`

- `bg_city_parcel_center.png`：无 UI、无文字的竖屏纸箱中转站背景，建议铺满 360 × 720 设计画布。

### `panels/`

- `panel_title_waybill.png`：顶部运单标题牌，文字应在预制件中单独配置。
- `panel_status_tintable.png`：可染色状态卡底板，用于分数、连击、目标等信息。
- `frame_board.png`：棋盘外框；中心与外部均透明，棋盘格和箱子放在其下层。
- `crate_piece_spawn.png`：底部出块货箱，可复用为三个槽位的底板。
- `panel_tutorial.png`：无文字教学提示牌，说明文字与手势节点另行叠加。

### `box/`

- `box_closed_tintable.png`：闭合纸箱基础块，使用 `Sprite.color` 生成不同箱体颜色。
- `box_open_tintable.png`：打开纸箱的前景遮挡层，使用与闭合纸箱相同的染色规则。

建议单格采用 `38 × 38` 至 `40 × 40` 的设计尺寸，并保持棋盘、待选块与拖拽预览使用同一缩放基准。

### `cats/`

- `cat_gray_white.png`
- `cat_calico.png`
- `cat_black.png`
- `cat_orange_tabby.png`
- `cat_white_blue.png`
- `cat_gray_green.png`
- `cat_cream_brown.png`

猫咪资源均包含头部与搭在纸箱边缘的前爪。组合时先放猫咪，再在其上方放 `box_open_tintable.png`，利用开口透明区露出猫咪，同时让纸箱前壁自然遮住下半部。

### `icons/`

- `icon_horizontal_clear.png`：横向消除。
- `icon_vertical_clear.png`：纵向消除。
- `icon_area_burst.png`：范围爆破。
- `icon_spread.png`：向外扩散。
- `icon_magnet.png`：磁铁吸附。
- `icon_convert.png`：转换效果。

技能徽章建议放在纸箱右下角或猫咪前爪旁，显示尺寸约为单格边长的 22%–28%。

## 推荐节点层级

```text
Canvas
├── Background                  bg_city_parcel_center
├── Header
│   ├── TitlePanel              panel_title_waybill
│   └── StatusCards             panel_status_tintable
├── Board
│   ├── Grid
│   ├── Pieces
│   │   └── BoxCell
│   │       ├── Cat             cats/*（可选）
│   │       ├── OpenBox         box_open_tintable（有猫时）
│   │       ├── ClosedBox       box_closed_tintable（无猫时）
│   │       └── SkillIcon       icons/*（可选）
│   └── Frame                   frame_board
├── PieceSpawnSlots
│   └── Crate                   crate_piece_spawn
└── TutorialPanel               panel_tutorial
```

## 导入约束

- 除背景外，所有图片的画布边缘均已清理为 `alpha = 0`，不要再叠加白底或棋盘格。
- 箱体和状态卡以中性色绘制，颜色变化应优先通过 Cocos 的 `Sprite.color` 实现，避免重复制作大量色图。
- 文案、数字和动态状态不应烘焙进图片，应在场景或预制件中使用真实文本节点。
- 若继续生成或改图，必须同时参考主参考图和 `docs/ART_STYLE.md`。
