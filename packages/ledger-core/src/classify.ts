import { CATEGORIES, type Category, type Kind, type Source } from "./model.js";

const CATEGORY_RULES: Array<{ pattern: RegExp; category: Category }> = [
  { pattern: /瑞幸|星巴克|咖啡|餐|外卖|小吃|麦当劳|肯德基/, category: "餐饮" },
  { pattern: /地铁|滴滴|公交|火车|出行|加油|停车/, category: "交通" },
  { pattern: /工资|薪资|薪酬/, category: "工资" },
  { pattern: /房租|物业|水费|电费|燃气/, category: "居住" },
  { pattern: /盒马|超市|便利店|日用/, category: "日用" },
  { pattern: /京东|淘宝|天猫|购物|拼多多/, category: "购物" },
  { pattern: /音乐|电影|游戏|会员/, category: "娱乐" },
  { pattern: /医院|药房|药店|挂号/, category: "医疗" },
];
export function classifyCategory(input: {
  text: string;
  hint: string;
  rules: Record<string, Category>;
  preserveHint?: boolean;
}): Category {
  const { text, hint, rules } = input;
  const customRule = Object.entries(rules).find(([merchant]) =>
    text.includes(merchant),
  );
  if (customRule) return customRule[1];
  const known =
    input.preserveHint && hint.trim()
      ? hint.trim()
      : CATEGORIES.find((category) => category === hint);
  return (
    known ??
    CATEGORY_RULES.find((rule) => rule.pattern.test(text))?.category ??
    "待分类"
  );
}
export function classifyKind(input: {
  direction: string;
  description: string;
  sourceStatus: string;
}): Kind | null {
  const { direction, description, sourceStatus } = input;
  if (/关闭|失败|未支付|撤销/.test(sourceStatus)) return "不计收支";
  if (direction === "转账" || direction === "退款") return direction;
  if (/退款/.test(description) && /收入|退/.test(direction + sourceStatus))
    return "退款";
  if (/还款|提现|充值|本人转账|账户互转/.test(description)) return "转账";
  if (/支出|借|支取|付款|消费|outflow|expense/i.test(direction)) return "支出";
  if (/收入|贷|存入|收款|income|inflow/i.test(direction)) return "收入";
  if (/不计|中性/.test(direction)) return "不计收支";
  return null;
}
export function identifySource(text: string): Source {
  if (/微信|wechat/i.test(text)) return "微信支付";
  if (/支付宝|alipay/i.test(text)) return "支付宝";
  if (/招商|招行|cmb/i.test(text)) return "招商银行";
  return "其他银行";
}
export function normalizeAccount(account: string, source: Source): string {
  const last4 = account.match(
    /(?:\(|（|尾号|\*+|·|卡号[:：]?\s*)(\d{4})(?:\)|）|\s|$)/,
  )?.[1];
  if (/招商|招行/.test(account)) return `招商银行${last4 ? " · " + last4 : ""}`;
  if (/零钱/.test(account)) return "微信零钱";
  if (/余额/.test(account) && source === "支付宝") return "支付宝余额";
  return account.trim();
}
