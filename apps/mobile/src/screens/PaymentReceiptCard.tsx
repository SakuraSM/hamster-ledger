import { useRef } from "react";
import { Alert } from "react-native";
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
  hideAmounts: boolean;
  onReview: (receipt: PaymentReceipt) => void;
  onDiscard: (receipt: PaymentReceipt) => Promise<boolean>;
}
export function PaymentReceiptCard({
  receipt,
  books,
  mode,
  isBusy,
  isRecorded,
  hideAmounts,
  onReview,
  onDiscard,
}: PaymentReceiptCardProps): React.JSX.Element {
  const discardPromptOpen = useRef(false);
  const discardInFlight = useRef(false);
  const candidate = parsePaymentNotification({
    receipt,
    localTimestamp: localTimestamp(receipt.postedAt),
  });
  const target = books.find((book) => book.id === receipt.bookId);
  const shouldHideAmount =
    hideAmounts ||
    mode !== receipt.bookId ||
    !target ||
    Boolean(target.isArchived || target.cloud);
  const merchant =
    shouldHideAmount && /\p{N}/u.test(candidate.merchant)
      ? "交易对象待核对"
      : candidate.merchant || "交易对象待填写";
  const amountLabel = candidate.amount
    ? shouldHideAmount
      ? "••••"
      : `¥${candidate.amount}`
    : "金额待核对";
  const canReview = Boolean(
    target && !target.isArchived && !target.cloud && candidate.isSupported,
  );
  function requestDiscard(): void {
    if (discardPromptOpen.current || discardInFlight.current || isBusy) return;
    discardPromptOpen.current = true;
    let handled = false;
    function finish(): boolean {
      if (handled) return false;
      handled = true;
      discardPromptOpen.current = false;
      return true;
    }
    Alert.alert(
      `忽略${receipt.source}支付消息？`,
      `${merchant} · ${amountLabel} · ${candidate.date}。忽略不会新增账单，也不会删除已关联的账单。`,
      [
        {
          text: "取消",
          style: "cancel",
          onPress: () => {
            finish();
          },
        },
        {
          text: "确认忽略",
          onPress: () => {
            if (!finish()) return;
            discardInFlight.current = true;
            void onDiscard(receipt).finally(() => {
              discardInFlight.current = false;
            });
          },
        },
      ],
      {
        cancelable: true,
        onDismiss: () => {
          finish();
        },
      },
    );
  }
  return (
    <Card mode="outlined">
      <Card.Content style={{ gap: 8 }}>
        <Text variant="titleMedium">{merchant}</Text>
        <Text>
          {receipt.source} · {target?.name ?? "目标账本已移除"}
        </Text>
        <Text variant="bodySmall">通知参考金额，核对前不计入收支</Text>
        <AmountText
          variant="titleLarge"
          amount={
            !shouldHideAmount && candidate.amount
              ? parseMinor({ value: candidate.amount, currency: "CNY" })
              : 0
          }
          tone={AMOUNT_TONES.NEUTRAL}
        >
          {candidate.type ? TRANSACTION_LABELS[candidate.type] : "类型待选择"} ·{" "}
          {amountLabel}
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
        <Button disabled={isBusy} onPress={requestDiscard}>
          忽略此消息
        </Button>
      </Card.Content>
    </Card>
  );
}
