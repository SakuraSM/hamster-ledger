import { pendingReviewCount, type Ledger } from "@hamster-ledger/core";
import { List, Text } from "react-native-paper";
import { Screen } from "../ui/Screen";
export const TOOLS = [
  {
    key: "payment-inbox",
    title: "支付消息记账",
    description: "支付宝、微信通知与本机待确认收件箱",
    icon: "message-text-outline",
  },
  {
    key: "ai",
    title: "AI 记账与凭证",
    description: "文本、多图、拍照与待确认草稿",
    icon: "text-box-search-outline",
  },
  {
    key: "planning",
    title: "订阅、借贷与储蓄目标",
    description: "固定开支、部分还款和目标进度",
    icon: "target",
  },
  {
    key: "notifications",
    title: "通知中心",
    description: "预算、订阅、借贷与还款提醒",
    icon: "bell-outline",
  },
  {
    key: "network",
    title: "家庭与联网账本",
    description: "共享、邀请与操作历史",
    icon: "account-group",
  },
  {
    key: "account",
    title: "账号与登录",
    description: "登录、密码与设备管理",
    icon: "account-outline",
  },
  {
    key: "sync",
    title: "云端同步",
    description: "前台自动同步、预览与冲突保留",
    icon: "upload",
  },
  {
    key: "books",
    title: "账本管理",
    description: "切换、创建与归档账本",
    icon: "book-outline",
  },
  {
    key: "import",
    title: "导入账单",
    description: "CSV / Excel 文件与字段核对",
    icon: "file-upload-outline",
  },
  {
    key: "review",
    title: "重复核对",
    description: "确认跨平台交易是否为同一笔",
    icon: "content-duplicate",
  },
  {
    key: "calendar",
    title: "账单日历",
    description: "按天查看和补记收支",
    icon: "calendar",
  },
  {
    key: "budgets",
    title: "预算管理",
    description: "总预算与分类预算",
    icon: "chart-pie",
  },
  {
    key: "recurring",
    title: "周期记账",
    description: "房租、工资与固定开支",
    icon: "clock-outline",
  },
  {
    key: "categories",
    title: "分类管理",
    description: "重命名、排序与归档",
    icon: "format-list-bulleted",
  },
  {
    key: "backup",
    title: "备份与导出",
    description: "完整备份、恢复与 Excel 分享",
    icon: "share-variant",
  },
  {
    key: "preferences",
    title: "记账偏好",
    description: "账期、主题与系统提醒",
    icon: "cog",
  },
] as const;
export type ToolPage = (typeof TOOLS)[number]["key"];
export function ToolsScreen({
  onSelect,
  ledger,
  storageDescription,
  onAssets,
}: {
  onSelect: (page: ToolPage) => void;
  ledger: Ledger;
  storageDescription: string;
  onAssets: () => void;
}): React.JSX.Element {
  return (
    <Screen>
      <Text variant="headlineSmall" accessibilityRole="header">
        更多功能
      </Text>
      <Text>{storageDescription}</Text>
      {!ledger.accounts.length && (
        <List.Item
          title="建立首个账户与余额基准"
          onPress={onAssets}
          left={(props) => <List.Icon {...props} icon="wallet-outline" />}
        />
      )}
      <Text variant="titleMedium" accessibilityRole="header">
        待处理
      </Text>
      <List.Item
        title={`账单核对 · ${pendingReviewCount(ledger)}`}
        onPress={() => onSelect("review")}
        left={(props) => <List.Icon {...props} icon="content-duplicate" />}
      />
      <List.Item
        title={`AI 草稿 · ${ledger.aiDrafts?.filter((item) => item.state === "pending").length ?? 0}`}
        onPress={() => onSelect("ai")}
        left={(props) => (
          <List.Icon {...props} icon="text-box-search-outline" />
        )}
      />
      <List.Item
        title="支付通知待确认"
        description="打开本机收件箱查看"
        onPress={() => onSelect("payment-inbox")}
        left={(props) => <List.Icon {...props} icon="message-text-outline" />}
      />
      {[
        {
          title: "记录与核对",
          keys: ["import", "calendar", "ai", "payment-inbox", "review"],
        },
        {
          title: "预算与计划",
          keys: ["budgets", "recurring", "planning", "notifications"],
        },
        { title: "账本与数据", keys: ["books", "network", "sync", "backup"] },
        { title: "账号与偏好", keys: ["account", "categories", "preferences"] },
      ].map((group) => (
        <List.Section key={group.title}>
          <List.Subheader>{group.title}</List.Subheader>
          {group.keys
            .map((key) => TOOLS.find((item) => item.key === key)!)
            .map((tool) => (
              <List.Item
                key={tool.key}
                title={tool.title}
                description={tool.description}
                onPress={() => onSelect(tool.key)}
                left={(props) => <List.Icon {...props} icon={tool.icon} />}
                right={(props) => <List.Icon {...props} icon="chevron-right" />}
              />
            ))}
        </List.Section>
      ))}
      <Text variant="bodySmall">
        账本在本机的加密数据库中保存。删除应用会移除本机数据，请定期导出备份。
      </Text>
    </Screen>
  );
}
