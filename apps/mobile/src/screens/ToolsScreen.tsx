import { List, Text } from "react-native-paper";
import { Screen } from "../ui/Screen";
export const TOOLS = [
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
    description: "主动同步、预览与冲突保留",
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
}: {
  onSelect: (page: ToolPage) => void;
}): React.JSX.Element {
  return (
    <Screen>
      <Text variant="headlineSmall" accessibilityRole="header">
        更多功能
      </Text>
      {TOOLS.map((tool) => (
        <List.Item
          key={tool.key}
          title={tool.title}
          description={tool.description}
          onPress={() => onSelect(tool.key)}
          left={(props) => <List.Icon {...props} icon={tool.icon} />}
          right={(props) => <List.Icon {...props} icon="chevron-right" />}
        />
      ))}
      <Text variant="bodySmall">
        账本在本机的加密数据库中保存。删除应用会移除本机数据，请定期导出备份。
      </Text>
    </Screen>
  );
}
