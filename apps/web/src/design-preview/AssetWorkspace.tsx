import {
  ASSET_ACCOUNTS,
  ASSET_TOTALS,
  NET_ASSETS,
  PERIOD_ASSET_CHANGE,
  assetMoney,
  type DesignAccount,
} from "./asset-fixture";
import { DesignIcon } from "./icons";
import type { SceneBodyProps, VisualBlock } from "./model";
import { VisualBlocks } from "./blocks";
const ACCOUNT_KINDS = [
  { id: "asset", name: "资产账户" },
  { id: "liability", name: "负债账户" },
] as const;
const ACCOUNT_DETAIL_SNAPSHOTS = {
  bank: { title: "工资卡", amount: 2600000, baseline: 1750000, change: 850000 },
  credit: { title: "信用卡", amount: 250000, baseline: 250000, change: 0 },
  cash: { title: "现金", amount: 320000, baseline: 325600, change: -5600 },
};
export function AssetsOverview({
  onNavigate,
  mode,
}: SceneBodyProps): React.JSX.Element {
  const accounts: DesignAccount[] =
    mode === "mobile"
      ? [
          ...ASSET_ACCOUNTS.filter(
            (account) => account.id === "bank" || account.id === "cash",
          ),
          {
            id: "wallets",
            name: "网络钱包",
            type: "网络钱包",
            minor: 172000,
            kind: "asset",
            note: "支付宝1,234 · 微信486 · 2个账户",
            icon: "wallet",
            target: "wallet-accounts",
          },
          ...ASSET_ACCOUNTS.filter((account) => account.kind === "liability"),
        ]
      : ASSET_ACCOUNTS;
  return (
    <div className="asset-workspace">
      <header className="asset-heading">
        <div>
          <h1>资产</h1>
          <button
            type="button"
            className="text-action"
            onClick={() => onNavigate("asset-date")}
          >
            截至 11月6日 <DesignIcon name="chevron" size={13} />
          </button>
        </div>
        <button
          type="button"
          className="asset-add"
          onClick={() => onNavigate("account-edit")}
        >
          <DesignIcon name="plus" size={18} />
          账户
        </button>
      </header>
      <section className="asset-net">
        <span>
          当前净资产 <DesignIcon name="eye" size={15} />
        </span>
        <strong>{assetMoney(NET_ASSETS)}</strong>
      </section>
      <div className="asset-composition">
        <div>
          <span>总资产</span>
          <b>{assetMoney(ASSET_TOTALS.assets)}</b>
        </div>
        <span className="composition-minus">−</span>
        <div>
          <span>总负债</span>
          <b>{assetMoney(ASSET_TOTALS.liabilities)}</b>
        </div>
      </div>
      <button
        className="asset-period"
        type="button"
        onClick={() => onNavigate("net-worth")}
      >
        <span>
          本月变化 <b>+{assetMoney(PERIOD_ASSET_CHANGE)}</b>
        </span>
        <DesignIcon name="chart" size={18} />
        <DesignIcon name="chevron" size={14} />
      </button>
      <div className="asset-account-groups">
        {ACCOUNT_KINDS.map((kind) => (
          <section key={kind.id}>
            <div className="account-group-title">
              <h2>{kind.name}</h2>
              <small>
                {
                  ASSET_ACCOUNTS.filter((account) => account.kind === kind.id)
                    .length
                }
                个
              </small>
            </div>
            {accounts
              .filter((account) => account.kind === kind.id)
              .map((account) => (
                <button
                  type="button"
                  className="asset-account-row"
                  key={account.id}
                  onClick={() => onNavigate(account.target)}
                >
                  <span className={`account-symbol ${account.kind}`}>
                    <DesignIcon name={account.icon} size={20} />
                  </span>
                  <span className="asset-account-copy">
                    <b>{account.name}</b>
                    <small>{account.note}</small>
                  </span>
                  <strong>{assetMoney(account.minor)}</strong>
                  <DesignIcon name="chevron" size={13} />
                </button>
              ))}
          </section>
        ))}
      </div>
      <button
        type="button"
        className="asset-unassigned"
        onClick={() => onNavigate("asset-unassigned")}
      >
        <DesignIcon name="warning" size={16} />
        <span>2笔历史账单尚未关联账户</span>
        <DesignIcon name="chevron" size={13} />
      </button>
    </div>
  );
}
export function AccountDetailScene(props: SceneBodyProps): React.JSX.Element {
  const { scene, onNavigate } = props;
  const isBank = scene.id === "bank-detail",
    isDebt = scene.id === "liability-detail";
  const details =
    ACCOUNT_DETAIL_SNAPSHOTS[isBank ? "bank" : isDebt ? "credit" : "cash"];
  const blocks: VisualBlock[] = [
    {
      kind: "choices",
      items: [
        { label: "余额变化", selected: true },
        { label: "原始账单", target: "account-records" },
      ],
    },
    {
      kind: "list",
      items: isBank
        ? [
            {
              label: "工资",
              value: "+¥8,500.00",
              note: "11月1日 09:00 · 已确认",
              icon: "wallet",
              target: "record",
            },
          ]
        : isDebt
          ? [
              {
                label: "期初负债基准",
                value: "¥2,500.00",
                note: "10月31日 · 之后暂无变动",
                icon: "wallet",
                target: "account-history",
              },
            ]
          : [
              {
                label: "午餐",
                value: "−¥32.00",
                note: "11月6日 12:10 · 已计入",
                icon: "food",
                target: "record",
              },
              {
                label: "打车",
                value: "−¥24.00",
                note: "11月6日 08:40 · 已计入",
                icon: "car",
                target: "record",
              },
            ],
    },
    {
      kind: "list",
      items: [
        {
          label: "余额基准与历史",
          value: "查看",
          icon: "clock",
          target: "account-history",
        },
        {
          label: "账户信息",
          value: "编辑",
          icon: "settings",
          target: isDebt ? "liability-edit" : "account-edit",
        },
      ],
    },
  ];
  return (
    <div className="asset-detail">
      <header className="asset-heading">
        <div>
          <h1>{details.title}</h1>
          <p>{isDebt ? "负债 · 信用卡" : "资产 · CNY"} / 截至11月6日</p>
        </div>
        <button
          type="button"
          className="icon-button"
          aria-label="编辑账户"
          onClick={() => onNavigate(isDebt ? "liability-edit" : "account-edit")}
        >
          <DesignIcon name="settings" />
        </button>
      </header>
      <section className="asset-net">
        <span>{isDebt ? "剩余负债" : "当前账户余额"}</span>
        <strong>{assetMoney(details.amount)}</strong>
      </section>
      <div className="asset-equation">
        <span>
          基准 <b>{assetMoney(details.baseline)}</b>
        </span>
        <span>
          {details.change >= 0 ? "+" : "−"} 已确认变动{" "}
          <b>{assetMoney(Math.abs(details.change))}</b>
        </span>
      </div>
      {isDebt ? (
        <div className="asset-debt-dates">
          <span>
            账单日 <b>每月8日</b>
          </span>
          <span>
            还款日 <b>每月18日</b>
          </span>
          <span>
            信用额度 <b>¥20,000.00</b>
          </span>
        </div>
      ) : (
        <p className="asset-explanation">
          余额来自基准之后的已确认流水。待确认和基准以前的账单不再叠加。
        </p>
      )}
      <VisualBlocks blocks={blocks} onNavigate={onNavigate} mode={props.mode} />
    </div>
  );
}
