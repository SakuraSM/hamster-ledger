import { AmountText } from "../ui/AmountText";
import { recordAmountTone } from "../ui/amount-tones";
import { RecordAttachments } from "./RecordAttachments";
import { TransactionFacts } from "./TransactionFacts";
import { ReceiptAction } from "./ReceiptAction";
import { useState } from "react";
import { Button, Text, Divider, Chip, useTheme } from "react-native-paper";
import { Alert, View } from "react-native";
import {
  deleteEntry,
  restoreEntry,
  signedMoney,
  type BillRecord,
} from "@hamster-ledger/core";
import type { LedgerController } from "@hamster-ledger/ledger-react";
import { FormSheet } from "../ui/FormSheet";
import { ErrorMessage, styles } from "../ui/Screen";
interface RecordDetailProps {
  controller: LedgerController;
  record: BillRecord;
  onClose: () => void;
  onEdit: (record: BillRecord) => void;
}
export function RecordDetail({
  controller,
  record,
  onClose,
  onEdit,
}: RecordDetailProps): React.JSX.Element {
  const [error, setError] = useState("");
  const theme = useTheme();
  const current =
    controller.ledger.records.find((item) => item.id === record.id) ?? record;
  const isAmountHidden = Boolean(controller.ledger.preferences?.hideAmounts);
  async function applyRemoval(): Promise<void> {
    try {
      await controller.commit(
        current.isDeleted
          ? restoreEntry(controller.ledger, current.id)
          : deleteEntry(controller.ledger, current.id),
      );
      onClose();
      controller.notify(
        current.isDeleted ? "已恢复账单" : "已移入回收站，关联流水一并保留",
      );
    } catch (cause) {
      setError(cause instanceof Error ? cause.message : "操作失败");
    }
  }
  return (
    <FormSheet title="账单详情" onClose={onClose}>
      <Text
        variant="headlineLarge"
        accessibilityRole="header"
        style={{ fontWeight: "700" }}
      >
        账单详情
      </Text>
      <Text style={{ color: theme.colors.onSurfaceVariant }}>
        {current.status === "confirmed"
          ? "已入账"
          : current.status === "pending"
            ? "待确认"
            : "重复记录"}{" "}
        · {current.source}
      </Text>
      <Text variant="titleMedium">
        {isAmountHidden ? "金额已隐藏" : current.merchant}
      </Text>
      <AmountText
        variant="displaySmall"
        amount={current.amount}
        tone={recordAmountTone(current)}
        isMuted={isAmountHidden}
      >
        {isAmountHidden ? "••••" : signedMoney(current)}
      </AmountText>
      <View style={styles.row}>
        <Chip>{current.kind}</Chip>
        {!isAmountHidden ? <Chip>{current.category}</Chip> : null}
      </View>
      <Divider />
      <Text variant="titleMedium">交易时间 · {current.date}</Text>
      {!isAmountHidden ? (
        <>
          <Text>分类：{current.category}</Text>
          <Text>
            收付款账户：
            {controller.ledger.accounts.find(
              (account) => account.id === current.accountId,
            )?.name ||
              current.account ||
              "未关联"}
          </Text>
          {current.transferToAccountId ? (
            <Text>
              转入账户：
              {controller.ledger.accounts.find(
                (account) => account.id === current.transferToAccountId,
              )?.name ?? "已归档账户"}
            </Text>
          ) : null}
          <Text>备注：{current.description || "无"}</Text>
          <Text>标签：{current.tags?.join("、") || "无"}</Text>
          <RecordAttachments controller={controller} recordId={current.id} />
          <TransactionFacts
            record={current}
            ledger={controller.ledger}
            bookId={
              controller.books.find((book) => book.id === controller.mode)
                ?.cloud?.id
            }
          />
          <Divider />
          <Text variant="titleMedium">原始流水</Text>
          {Object.entries(current.raw).map(([name, value]) => (
            <Text key={name} selectable>
              {name}：{value}
            </Text>
          ))}
        </>
      ) : (
        <Text>金额、原始流水与凭证已隐藏；编辑时可核对完整信息。</Text>
      )}
      <ErrorMessage message={error} />
      {!current.isDeleted ? (
        <ReceiptAction onPress={() => onEdit(current)}>编辑账单</ReceiptAction>
      ) : null}
      <Button
        mode="outlined"
        contentStyle={{ minHeight: 48 }}
        disabled={controller.isSaving}
        onPress={() =>
          current.isDeleted
            ? void applyRemoval()
            : Alert.alert(
                "移入回收站",
                "同一笔交易的关联流水也会移入回收站，之后可以恢复。",
                [
                  { text: "取消", style: "cancel" },
                  { text: "移入回收站", onPress: () => void applyRemoval() },
                ],
              )
        }
      >
        {current.isDeleted ? "恢复账单" : "移入回收站"}
      </Button>
    </FormSheet>
  );
}
