import { money } from "@hamster-ledger/core";
import type { IconName } from "./model";
export interface DesignAccount {
  id: string;
  name: string;
  type: string;
  minor: number;
  kind: "asset" | "liability";
  note: string;
  icon: IconName;
  target: string;
}
export const ASSET_ACCOUNTS: DesignAccount[] = [
  {
    id: "bank",
    name: "工资卡",
    type: "银行卡",
    minor: 2600000,
    kind: "asset",
    note: "CNY · 基准与流水已核对",
    icon: "wallet",
    target: "bank-detail",
  },
  {
    id: "cash",
    name: "现金",
    type: "现金",
    minor: 320000,
    kind: "asset",
    note: "基准3,256 · 之后−56",
    icon: "wallet",
    target: "account-detail",
  },
  {
    id: "alipay",
    name: "支付宝",
    type: "网络钱包",
    minor: 123400,
    kind: "asset",
    note: "CNY · 已关联5笔支出",
    icon: "wallet",
    target: "account-records",
  },
  {
    id: "wechat",
    name: "微信",
    type: "网络钱包",
    minor: 48600,
    kind: "asset",
    note: "CNY · 暂无基准后变动",
    icon: "wallet",
    target: "account-records",
  },
  {
    id: "credit",
    name: "信用卡",
    type: "信用卡",
    minor: 250000,
    kind: "liability",
    note: "18日还款 · 额度20,000",
    icon: "wallet",
    target: "liability-detail",
  },
];
export const ASSET_TOTALS = ASSET_ACCOUNTS.reduce(
  (result, account) => ({
    assets: result.assets + (account.kind === "asset" ? account.minor : 0),
    liabilities:
      result.liabilities + (account.kind === "liability" ? account.minor : 0),
  }),
  { assets: 0, liabilities: 0 },
);
export const NET_ASSETS = ASSET_TOTALS.assets - ASSET_TOTALS.liabilities;
export const PERIOD_ASSET_CHANGE = 721360;
export function assetMoney(minor: number): string {
  return `¥${money(minor)}`;
}
