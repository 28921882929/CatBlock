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

- `box_closed_skin_*.png`：10 张独立闭箱皮肤，主色、纸张纹理和低对比压印均已烘焙进图片。
- `box_open_skin_*.png`：与闭箱皮肤一一配对的开箱前景层，中间透明区域用于露出猫咪。
- `box_*_tintable.png`：旧版可染色基础资源，仅保留作美术结构参考，正式玩法不再引用。

主界面按参考图复刻时，棋盘单格采用 `35 × 35`、格距采用 `37`；货箱内待选块采用 `27 × 27`。棋盘、待选块与拖拽预览由同一套逻辑尺寸换算，禁止再对局部节点单独拉伸。

### `cats/`

- `cat_gray_white.png`
- `cat_calico.png`
- `cat_black.png`
- `cat_orange_tabby.png`
- `cat_white_blue.png`
- `cat_gray_green.png`
- `cat_cream_brown.png`
- `cat_instructor.png`：底部教程牌左侧的快递员猫与思考气泡组合，按主参考图中的构图生成并清理为透明背景。

猫咪资源均包含头部与搭在纸箱边缘的前爪。组合时先放猫咪，再在其上方放 `box_open_tintable.png`，利用开口透明区露出猫咪，同时让纸箱前壁自然遮住下半部。

### `icons/`

- `icon_horizontal_clear.png`：横向消除。
- `icon_vertical_clear.png`：纵向消除。
- `icon_area_burst.png`：范围爆破。
- `icon_spread.png`：向外扩散。
- `icon_magnet.png`：磁铁吸附。
- `icon_convert.png`：转换效果。
- `icon_status_cat.png`：顶部第一张状态卡使用的猫咪圆形徽章。

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
- 纸箱皮肤统一使用 `128 × 128` 画布和 Custom Trim，禁止开启 Auto Trim，避免开箱左右边缘被再次裁切。
- 闭箱与开箱均由选定的 A「软萌贴纸纸箱」母版派生，可视主体固定为 `112 × 112` 正方形并居中放入画布；圆角、奶油贴纸外沿、可可棕细描边、牛皮纸角贴和底部短阴影不得因颜色变化。
- 普通闭箱使用居中的大号凹刻图案，并以少量粉彩纸屑和细纸纤维辅助装饰；图案需要在棋盘实际尺寸下清晰可辨，边缘不得保留拆分产生的离散残片。
- 纸箱配色保持鲜亮、温暖和偏粉彩，但中间色不得过曝；暗部使用温暖可可棕而非近黑色，高光使用奶油色，避免把纸板处理成果冻或塑料质感。
- 中央压印采用“左上浅高光、右下同色暗边”的凹刻层次；纸面纹理不得进入透明区域、盖过压印或破坏贴纸式外轮廓。
- 箱体使用独立皮肤图片呈现颜色、压印与纸板细节；`Sprite.color` 只用于拖拽时的合法/非法状态反馈。
- 文案、数字和动态状态不应烘焙进图片，应在场景或预制件中使用真实文本节点。
- 若继续生成或改图，必须同时参考主参考图和 `docs/ART_STYLE.md`。
