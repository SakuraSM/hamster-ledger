# 视觉方向与图像来源

用户选择第二轮第3张“凭证接力”，随后要求资产管理优先。该选择对应 `assets/selected-direction.png`，不是第一轮同编号图片。

本次使用内置 imagegen；没有使用CLI、外部出图API或其它模型。仓鼠标识复用项目已有图像，图标复用Phosphor，图表使用现有Recharts。所有票据与账务数据均为虚构样本。

| 文件                            | 用途                                                         |
| ------------------------------- | ------------------------------------------------------------ |
| `assets/selected-direction.png` | 用户选定的整体方向，作为字体层级、纸张、颜色和操作节奏的参考 |
| `assets/paper-sheet.png`        | 透明票据纸张背景，真实UI文字和控件置于其上                   |
| `assets/cafe-receipt.png`       | 合成咖啡小票原图，18元，不含真实商户标识或私人信息           |

## 纸张背景最终提示词

> Create a single blank functional paper-sheet background asset for the selected receipt-themed 仓鼠记账 UI. Reference image is the approved entire UI, only extract its MATERIAL STYLE, do not reproduce any interface or text. This asset will sit behind real editable HTML UI labels. Target logical visible sheet 328 x 400, render a crisp transparent PNG with that aspect ratio. FRONT ON ORTHOGRAPHIC, no perspective or rotation. A clean warm-white rectangular receipt sheet filling nearly the whole canvas, slight chamfer cuts at top-left/top-right corners, subtle rounded scalloped perforation along the bottom edge like the reference. Tiny paper softness, almost perfectly flat, no folds, no grunge, no stains. Restrained soft shadow outside the lower edge, no obvious gray background. Completely EMPTY inside, absolutely no text, numbers, logo, borders, icons, typography or UI. One sheet only, not stacked. Transparency around sheet and through the cutout corners/perforated bottom. Match the calm premium white paper and minimalist material of the central approved receipt, not a realistic desk photograph.

参考为用户选定方向图，生成时要求透明背景。

## 咖啡原始凭证最终提示词

> Create ONE isolated synthetic cafe receipt image for a high-quality Chinese personal finance visual draft. Match the little source receipt shown inside the attached approved UI reference. Only the small original-receipt content, no app screen, phone, surrounding controls, merchant logos, QR codes, real identifiers or private data. Target landscape aspect2:1, logical220x110 pixels rendered crisply at high resolution. White slightly textured paper on very pale warm gray background, straight-on flat scanner style, subtle soft paper edges. Text must read exactly: centered '街角咖啡', then a light dashed printed separator, one row '拿铁' at left and '1 × 18.00' at right, then another separator, then bold '合计' left and '¥18.00' right. Tiny unobtrusive footer '示例凭证 · 2026-11-06'. Chinese thermal receipt type, black/charcoal, believable typography, no other text. Keep all words inside generous paper margins and ensure the eighteen-yuan total is coherent. Asset only, production-ready readable receipt thumbnail, no decorative scene.

参考为用户选定方向图，生成时要求保留纸张背景。该凭证作为完整图像使用，没有把票据文字拆成重绘的UI字段。
