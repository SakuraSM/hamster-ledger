# Android 净资产趋势图

净资产图改为金额、期间增减和曲线组成的卡片，并放到报表明细前。此前的图表没有刻度，纵轴固定包含零，十余万元资产的小幅变化接近水平线。

## 参考来源与取舍

- [鲨鱼记账官网](https://www.shayujizhang.com/)的[统计宣传截图](https://www.shayujizhang.com/img/fun-feature2.png)把时间范围、汇总金额、点选读数和分类排行组织在同一页。采用这种阅读顺序，保留仓鼠记账的奶油暖棕、鼠尾草绿和深夜账本主题。
- [Intuit Design 的 Mint Net Worth Graph](https://dribbble.com/shots/14872325-Mint-Net-Worth-Graph)展示了时间范围切换和沿曲线读数。本次提供本月、近三月、今年快捷范围，以及点选、上一期、下一期读数。

参考来自官方公开宣传素材和社区设计案例，不代表对这些产品当前安装版本的完整体验或逐像素复刻。

## 展示与数据语义

- 选中点显示完整日期和净资产金额。期间净增、净减或持平始终比较整个所选范围的起止日，不随点选改变。
- 曲线带金额刻度、日期、数据点、选中指示线和浅色面积。横坐标按真实日期间隔排列，纵轴按数据范围缩放，界面明确提示缩放方式。
- 单点显示圆点；持平值显示水平线；负净资产正常绘制。起止日估值不完整时不计算期间增减，缺汇率的位置不连接。
- 每期完整金额保留在可展开的估值明细中。点选区域和翻期按钮带原生无障碍标签，翻期按钮实际点击区域至少 48dp。
- 沿用 `useReportData`、月末及起止日采样、历史汇率和归档账户规则。未改账本结构、账户余额算法或汇率接口。

## 验证记录

`npm run check` 通过 231 项测试：168 项 Vitest、50 项服务端、4 项 Sites 和 9 项依赖检查。新增 9 项图表测试覆盖真实时间间隔、缺汇率断点、空结果、单点、持平、负资产、选点边界和字体缩放。`npm run android:apk` 的 ARM64 Release 构建通过。

截图来自 Android API 36 模拟器的原生 APK，使用独立的示例账本。对比范围为 2026-09-01 至 2026-10-11，起点 ¥114,472.06，期末 ¥124,557.70，期间净增 ¥10,085.64。截图不是浏览器预览或设计稿。

| 状态                | 截图                                                                          |
| ------------------- | ----------------------------------------------------------------------------- |
| 原暖棕图表          | [warm.png](evidence/android-asset-trend/warm.png)                             |
| 新暖棕图表          | [warm.png](evidence/android-asset-trend/after/warm.png)                       |
| 选中起点            | [selected-start.png](evidence/android-asset-trend/after/selected-start.png)   |
| 展开估值明细        | [details.png](evidence/android-asset-trend/after/details.png)                 |
| 鼠尾草绿            | [sage.png](evidence/android-asset-trend/after/sage.png)                       |
| 深夜账本            | [night.png](evidence/android-asset-trend/after/night.png)                     |
| 320dp 与 1.3 倍字体 | [narrow-dark.png](evidence/android-asset-trend/after/narrow-dark.png)         |
| 小屏翻期按钮        | [narrow-controls.png](evidence/android-asset-trend/after/narrow-controls.png) |
| 单个估值点          | [single-point.png](evidence/android-asset-trend/after/single-point.png)       |

原生点选后日期和金额更新，翻期按钮切换到相邻估值，明细可展开。本月、近三月和今年分别切换到 2026-10-01、2026-08-01 和 2026-01-01，结束日期保持 2026-10-11。小屏大字体下金额没有拆行，滚动后可完整操作翻期和明细按钮。单日范围显示单个估值点，不计算期间变化。

验证后恢复原账本、奶油暖棕主题、420dpi 密度和 1.0 倍字体。无障碍验证范围是原生节点标签和点击区域；未将 DOM 审计或构建结果视为 TalkBack 人工验收。

测试 APK 为 0.2.0 ARM64，使用开发签名，供安装验证。SHA256：`dfe01d9974c180ea0545c22f9eaecaf6cad85f0e0cd3b95726604e984fd9080f`。
