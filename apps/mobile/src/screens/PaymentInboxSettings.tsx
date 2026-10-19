import { Button, Checkbox, Switch, Text, List } from "react-native-paper";
import type { Book } from "@hamster-ledger/core";
import { ChoiceField } from "../ui/ChoiceField";
import {
  PAYMENT_SOURCES,
  isPaymentBookId,
  type PaymentInboxConfig,
  type PaymentInboxStatus,
} from "../platform/payment-inbox";
interface PaymentInboxSettingsProps {
  value: PaymentInboxConfig;
  onChange: (value: PaymentInboxConfig) => void;
  status: PaymentInboxStatus | null;
  books: Book[];
  isBusy: boolean;
  isLoading: boolean;
  onSave: () => void;
  onSettings: () => void;
  onRefresh: () => void;
  onClear: () => void;
}
const CAPTURE_ERRORS: Record<string, string> = {
  storage_full: "收件箱已满，部分新通知未保存。请先核对消息，并结合账单对账。",
  capture_failed:
    "部分支付通知保存失败，请检查设备存储并核对账单。原数据已保留。",
};
function captureLabel(status: PaymentInboxStatus | null): string {
  if (!status) return "正在读取采集状态";
  if (!status.enabled) return "采集已关闭";
  if (!status.permissionGranted) return "等待通知使用权授权";
  return status.connected ? "系统监听已连接" : "已授权，等待系统连接";
}
export function PaymentInboxSettings({
  value,
  onChange,
  status,
  books,
  isBusy,
  isLoading,
  onSave,
  onSettings,
  onRefresh,
  onClear,
}: PaymentInboxSettingsProps): React.JSX.Element {
  const availableBooks = books.filter(
    (book) => isPaymentBookId(book.id) && !book.isArchived && !book.cloud,
  );
  const isDisabled = isBusy || isLoading || !status;
  return (
    <>
      <Text variant="headlineSmall" accessibilityRole="header">
        支付消息记账
      </Text>
      <Text>
        后台采集支付宝、微信的支付通知，打开此页核对后入账。未确认消息仅本机加密保存，不参与备份和同步。
      </Text>
      <Text accessibilityLiveRegion="polite">
        {captureLabel(status)} · 待确认 {status?.pendingCount ?? 0} 条
      </Text>
      {status && (
        <Text>
          通知使用权：{status.permissionGranted ? "已授权" : "未授权"}
          ；监听连接：{status.connected ? "已连接" : "未连接"}
          。已授权但未连接时，可重新开启系统通知使用权后刷新。系统通知未出现、来源未勾选或省电限制，都可能导致未采集；请以原账单核对。
        </Text>
      )}
      {status?.error ? (
        <Text accessibilityLiveRegion="polite">
          {CAPTURE_ERRORS[status.error] ?? "支付消息采集异常，请检查后重试。"}
        </Text>
      ) : null}
      <List.Item
        title="采集支付消息"
        right={() => (
          <Switch
            accessibilityLabel="采集支付消息"
            value={value.enabled}
            disabled={isDisabled}
            onValueChange={(enabled) => onChange({ ...value, enabled })}
          />
        )}
      />
      {PAYMENT_SOURCES.map((source) => (
        <Checkbox.Item
          key={source}
          label={`采集${source}通知`}
          status={value.sources.includes(source) ? "checked" : "unchecked"}
          disabled={isDisabled}
          onPress={() =>
            onChange({
              ...value,
              sources: value.sources.includes(source)
                ? value.sources.filter((item) => item !== source)
                : [...value.sources, source],
            })
          }
        />
      ))}
      <ChoiceField
        label="目标本机账本"
        value={value.bookId}
        disabled={isDisabled}
        options={availableBooks.map((book) => ({
          value: book.id,
          label: book.name,
        }))}
        onChange={(bookId) => {
          const book = availableBooks.find((item) => item.id === bookId);
          if (book && isPaymentBookId(book.id))
            onChange({ ...value, bookId: book.id });
        }}
      />
      <Button
        mode="contained"
        loading={isBusy}
        disabled={isDisabled}
        onPress={onSave}
      >
        保存采集设置
      </Button>
      <Button mode="outlined" disabled={isBusy} onPress={onSettings}>
        打开系统通知使用权设置
      </Button>
      <Text variant="bodySmall">
        普通“允许发送通知”不能读取支付消息。这里只按支付通知规则处理所选来源，聊天、验证码和营销消息不采集。消息有效期七天，上限
        500
        条，过期内容在下次访问或采集时清理。系统隐藏正文、聚合通知和省电限制可能造成漏记，请结合账单对账。
      </Text>
      <Button icon="refresh" disabled={isBusy || isLoading} onPress={onRefresh}>
        刷新收件箱
      </Button>
      <Button
        icon="delete-outline"
        disabled={isBusy || !status}
        onPress={onClear}
      >
        清空本机收件箱
      </Button>
    </>
  );
}
