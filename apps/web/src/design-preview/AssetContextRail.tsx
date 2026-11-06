import { ASSET_TOTALS, NET_ASSETS, assetMoney } from "./asset-fixture";
import { DesignIcon } from "./icons";
import type { SceneBodyProps } from "./model";
interface AssetContext {
  title: string;
  label: string;
  total: string;
  rows: Array<{ label: string; value: string }>;
  note: string;
}
const SPECIAL_CONTEXT: Record<string, AssetContext> = {
  "credit-prepaid": {
    title: "预存不是剩余负债",
    label: "独立信用卡示例",
    total: "预存 ¥500.00",
    rows: [
      { label: "剩余负债", value: "¥0.00" },
      { label: "账户基准", value: "−¥500.00" },
    ],
    note: "负债账户为负值时，按预存含义展示，并保留余额基准与历史。",
  },
  "asset-archived": {
    title: "范围变了，历史没丢",
    label: "归档后当前净资产",
    total: "¥25,220.00",
    rows: [
      { label: "当前总资产", value: "¥27,720.00" },
      { label: "当前总负债", value: "¥2,500.00" },
    ],
    note: "现金账户从本次归档起退出当前合计。之前日期的账户状态仍按历史计算。",
  },
  assets: {
    title: "这月的变化，拆开看",
    label: "净资产变化",
    total: "+¥7,213.60",
    rows: [
      { label: "已确认收入", value: "+¥8,500.00" },
      { label: "已确认净支出", value: "−¥1,286.40" },
    ],
    note: "期初¥21,206.40 → 期末¥28,420.00。账户间转账与还款不改变净资产。",
  },
  "foreign-account": {
    title: "原币与估值分开看",
    label: "外币示例估值",
    total: "¥1,420.00",
    rows: [
      { label: "原币余额", value: "US$200.00" },
      { label: "手动参考值", value: "7.10" },
    ],
    note: "示例参考值不代表市场报价。缺少汇率时明确标注，不用1:1代替。",
  },
  rates: {
    title: "让每次换算有依据",
    label: "估值资料",
    total: "1项待补",
    rows: [
      { label: "USD", value: "手动 7.10" },
      { label: "EUR", value: "缺少参考汇率" },
    ],
    note: "估值日期、汇率来源与原币余额都要保留。未完整的估值不显示为完整合计。",
  },
  "missing-baseline": {
    title: "未知，不等于0元",
    label: "资产统计状态",
    total: "尚不完整",
    rows: [
      { label: "缺少余额基准", value: "备用账户" },
      { label: "影响", value: "该账户未计入" },
    ],
    note: "先补充明确的实际余额和确认时间，再解释后续已确认流水的变化。",
  },
  "investment-account": {
    title: "你核对的值，有记录",
    label: "投资示例 · 手动估值",
    total: "¥12,000.00",
    rows: [
      { label: "最近确认", value: "11月6日 16:00" },
      { label: "行情接入", value: "无实时查询" },
    ],
    note: "用既有账户基准记录核对后的估值，保留历史，不生成虚构的自动收益。",
  },
  "calibration-done": {
    title: "新基准，旧历史都在",
    label: "校准后净资产",
    total: "¥28,400.00",
    rows: [
      { label: "校准差额", value: "−¥20.00" },
      { label: "新增消费账单", value: "0 笔" },
    ],
    note: "余额变化来自新的实际余额基准，旧时间之前的历史计算继续保留。",
  },
  "card-repayment-done": {
    title: "钱移动了，净值未变",
    label: "还款后净资产",
    total: "¥28,420.00",
    rows: [
      { label: "工资卡", value: "¥25,500.00" },
      { label: "信用卡剩余负债", value: "¥2,000.00" },
    ],
    note: "资产与负债同时减少500元，净资产不变，还款不重复计支出。",
  },
};
export function AssetContextRail({
  scene,
  onNavigate,
}: SceneBodyProps): React.JSX.Element {
  const context = SPECIAL_CONTEXT[scene.id] ?? {
    title: "余额，都能找到来处",
    label: "当前净资产",
    total: assetMoney(NET_ASSETS),
    rows: [
      { label: "总资产", value: assetMoney(ASSET_TOTALS.assets) },
      { label: "总负债", value: assetMoney(ASSET_TOTALS.liabilities) },
    ],
    note: "余额基于明确基准与之后的已确认流水。待确认、重复和已删除记录不重复叠加。",
  };
  return (
    <aside className="context-rail">
      <span className="rail-eyebrow">资产管理 / 2026-11-06</span>
      <h2>{context.title}</h2>
      <div className="rail-total">
        <small>{context.label}</small>
        <strong>{context.total}</strong>
      </div>
      <dl>
        {context.rows.map((row) => (
          <div key={row.label}>
            <dt>{row.label}</dt>
            <dd>{row.value}</dd>
          </div>
        ))}
      </dl>
      <div className="rail-note">
        <DesignIcon name="shield" size={23} />
        <p>{context.note}</p>
      </div>
      <div className="rail-links">
        <button type="button" onClick={() => onNavigate("account-history")}>
          <DesignIcon name="clock" />
          追溯余额与流水
          <DesignIcon name="chevron" size={15} />
        </button>
        <button type="button" onClick={() => onNavigate("asset-date")}>
          <DesignIcon name="calendar" />
          估值日期与范围
          <DesignIcon name="chevron" size={15} />
        </button>
        <button type="button" onClick={() => onNavigate("rates")}>
          <DesignIcon name="globe" />
          汇率与缺失项
          <DesignIcon name="chevron" size={15} />
        </button>
      </div>
    </aside>
  );
}
