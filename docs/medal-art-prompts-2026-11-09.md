# 林间勋章素材与生成记录

2026 年 11 月 9 日。使用内置 `image_gen.imagegen` 分别生成三枚游戏勋章，均设置 `transparent_background: true`；没有使用 API key 或 CLI 后备流程。输入为文字说明，没有参考图或编辑目标。

## 项目文件

| 文件 | 对应勋章 | 图案 | 验证 |
| --- | --- | --- | --- |
| `public/assets/medals/canopy-listener.png` | 树梢倾听者 | 自然垂在枝杈上的小熊猫环纹尾巴与叶片 | 1254 × 1254 PNG，带 alpha 通道，已逐张视觉检查 |
| `public/assets/medals/trail-finder.png` | 雨后寻踪者 | 足迹、雨滴与落叶 | 1254 × 1254 PNG，带 alpha 通道，已逐张视觉检查 |
| `public/assets/medals/leaf-reader.png` | 林缘小匠 | 木质小桥与竹叶 | 1254 × 1254 PNG，带 alpha 通道，已逐张视觉检查 |

三枚采用统一的奶油色底、森林绿主体和金铜色边框。画面不含文字、数字或品牌标记；名称、获得日期与用途由界面呈现。原始输出直接复制至项目，未裁切、缩放或重绘。

PNG 原图分别约 2.5 MB、2.3 MB、2.8 MB。卡片和照片角标显示时复用这些文件；后续发布如需压缩，应同时保留透明度、边缘清晰度和原始来源记录。

## 每次调用的共同提示词

```text
Use case: stylized-concept. Asset type: a single collectible woodland conservation game medal used in a cozy web game and as a photo corner emblem. Create one circular premium enamel keepsake badge, centered, frontal view, substantial composition filling about 84 percent of a square image with generous clean transparent margin. Refined painted enamel / softly layered papercraft miniature finish, warm ivory base, dark forest-green outlines and fills, restrained copper-gold raised rim, warm natural highlights, small tactile details with bold readable silhouettes. Quiet, warm, polished, nature-inspired. Works at 96 pixel display size. Genuine transparent background outside the medal. No text, no letters, no numbers, no watermark, no logo, no ribbon tails, no separate extra objects outside the badge.
```

每次调用在共同提示词后附加以下各自的 `Subject`。

### 树梢倾听者

```text
Subject: The central motif is the recognizable rust-orange and cream ringed fluffy tail of a red panda resting softly across a sturdy tree branch with a few green leaves. The tail is naturally draped, not gripping the branch. The red panda body and face are not shown. Broad elegant silhouette, forest canopy feeling.
```

原始文件：`[local artifact path omitted]`。

### 雨后寻踪者

```text
Subject: The central motif is one simple woodland animal paw print impressed in a soft forest-green shape, accompanied by a single small blue-green rain droplet and two warm autumn leaves, arranged as a balanced, legible miniature scene. Rain-after-walk discovery feeling. Clear paw pad silhouette with four small toes, no animal body.
```

原始文件：`[local artifact path omitted]`。

### 林缘小匠

```text
Subject: The central motif is a small sturdy wooden footbridge made of warm ochre wood planks and short rounded rails, crossing a tiny leafy forest gap, with a few stylized bamboo leaves framing the upper side. Charming woodland craftsmanship feeling. The bridge is bold and legible, with only a few visible planks, no tiny buildings or people.
```

原始文件：`[local artifact path omitted]`。

## 使用范围

这些图像仅用于虚拟勋章、收藏详情与照片角标，不作为现实救助照片或机构成果证据。未生成任何现实机构的标志、证书或背书。
