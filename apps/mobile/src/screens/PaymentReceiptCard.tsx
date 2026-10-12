import { Button, Card, Text } from "react-native-paper";
import {
  parsePaymentNotification,
  parseMinor,
  TRANSACTION_LABELS,
  type PaymentReceipt,
  type Book,
  type LedgerMode,
} from "@hamster-ledger/core";
import { localTimestamp } from "../platform/runtime";
import { AmountText } from "../ui/AmountText";
import { AMOUNT_TONES } from "../ui/amount-tones";
interface PaymentReceiptCardProps {
  receipt: PaymentReceipt;
  books: Book[];
  mode: LedgerMode;
  isBusy: boolean;
  isRecorded: boolean;
  onReview: (receipt: PaymentReceipt) => void;
  onDiscard: (receipt: PaymentReceipt) => void;
}
export function PaymentReceiptCard({
  receipt,
  books,
  mode,
  isBusy,
  isRecorded,
  onReview,
  onDiscard,
}: PaymentReceiptCardProps): React.JSX.Element {
  const candidate = parsePaymentNotification({
    receipt,
    localTimestamp: localTimestamp(receipt.postedAt),
  });
  const target = books.find((book) => book.id === receipt.bookId);
  const canReview = Boolean(
    target && !target.isArchived && !target.cloud && candidate.isSupported,
  );
  return (
    <Card mode="outlined">
      <Card.Content style={{ gap: 8 }}>
        <Text variant="titleMedium">
          {candidate.merchant || "交易对象待填写"}
        </Text>
        <Text>
          {receipt.source} · {target?.name ?? "目标账本已移除"}
        </Text>
        <Text variant="bodySmall">通知参考金额，核对前不计入收支</Text>
        <AmountText
          variant="titleLarge"
          amount={
            candidate.amount
              ? parseMinor({ value: candidate.amount, currency: "CNY" })
              : 0
          }
          tone={AMOUNT_TONES.NEUTRAL}
        >
          {candidate.type ? TRANSACTION_LABELS[candidate.type] : "类型待选择"} ·{" "}
          {candidate.amount ? `¥${candidate.amount}` : "金额待核对"}
        </AmountText>
        <Text>{candidate.date}</Text>
        <Text variant="bodySmall">{candidate.issues.join("\n")}</Text>
        {isRecorded ? (
          <Text>已入账，消息状态待更新，不会重复记账。</Text>
        ) : null}
        {!canReview ? (
          <Text>目标账本不可用或交易暂不支持，请核对后手动处理。</Text>
        ) : null}
        <Button
          mode="contained"
          disabled={isBusy || !canReview}
          onPress={() => onReview(receipt)}
        >
          {mode === receipt.bookId ? "核对并入账" : "切换至绑定账本核对"}
        </Button>
        <Button disabled={isBusy} onPress={() => onDiscard(receipt)}>
          忽略此消息
        </Button>
      </Card.Content>
    </Card>
  );
}
