import { useEffect, useRef, useState } from "react";
import { Alert, FlatList } from "react-native";
import { Text } from "react-native-paper";
import {
  paymentReceiptRecord,
  type PaymentReceipt,
} from "@hamster-ledger/core";
import type { LedgerController } from "@hamster-ledger/ledger-react";
import { usePaymentInbox } from "../hooks/usePaymentInbox";
import { useSystemFontScale } from "../hooks/useSystemFontScale";
import type { PaymentInboxConfig } from "../platform/payment-inbox";
import { ErrorMessage } from "../ui/Screen";
import { PaymentInboxSettings } from "./PaymentInboxSettings";
import { PaymentReceiptCard } from "./PaymentReceiptCard";
import { PaymentReceiptReview } from "./PaymentReceiptReview";
export function PaymentInboxScreen({
  controller,
}: {
  controller: LedgerController;
}): React.JSX.Element {
  const inbox = usePaymentInbox({ controller }),
    fontScale = useSystemFontScale();
  const [draft, setDraft] = useState<PaymentInboxConfig>({
      enabled: false,
      sources: [],
      bookId: "",
    }),
    [editing, setEditing] = useState<PaymentReceipt | null>(null),
    initialized = useRef(false);
  useEffect(() => {
    if (inbox.status && !initialized.current) {
      initialized.current = true;
      setDraft({
        enabled: inbox.status.enabled,
        sources: inbox.status.sources,
        bookId: inbox.status.bookId,
      });
    }
  }, [inbox.status]);
  function review(receipt: PaymentReceipt): void {
    if (controller.mode !== receipt.bookId) {
      controller.switchMode(receipt.bookId);
      controller.notify("已切换至消息绑定账本，请再次核对。");
      return;
    }
    setEditing(receipt);
  }
  function requestClear(): void {
    Alert.alert(
      "清空支付消息？",
      "未确认消息将从本机移除，不会删除已入账账单。",
      [
        { text: "取消", style: "cancel" },
        {
          text: "清空",
          style: "destructive",
          onPress: () => void inbox.clear(),
        },
      ],
    );
  }
  const header = (
    <>
      <PaymentInboxSettings
        value={draft}
        onChange={setDraft}
        status={inbox.status}
        books={controller.books}
        isBusy={inbox.isBusy}
        isLoading={inbox.isLoading}
        onSave={() => void inbox.configure(draft)}
        onSettings={() => void inbox.openSettings()}
        onRefresh={() => void inbox.refresh()}
        onClear={requestClear}
      />
      <ErrorMessage message={inbox.error} />
      <Text variant="titleMedium">待确认消息（{inbox.receipts.length}）</Text>
    </>
  );
  return (
    <>
      <FlatList
        key={fontScale}
        contentContainerStyle={{ padding: 20, paddingBottom: 100, gap: 16 }}
        data={inbox.receipts}
        keyExtractor={(item) => item.id}
        ListHeaderComponent={header}
        ListEmptyComponent={
          <Text>
            {inbox.isLoading
              ? "正在读取加密收件箱…"
              : inbox.status
                ? "暂无待确认的支付消息。"
                : "收件箱暂不可用，请查看上方提示。"}
          </Text>
        }
        renderItem={({ item }) => (
          <PaymentReceiptCard
            receipt={item}
            books={controller.books}
            mode={controller.mode}
            isBusy={inbox.isBusy}
            isRecorded={
              controller.mode === item.bookId &&
              Boolean(
                paymentReceiptRecord({
                  ledger: controller.ledger,
                  receiptId: item.id,
                }),
              )
            }
            onReview={review}
            onDiscard={(receipt) => void inbox.discard(receipt)}
          />
        )}
      />
      {editing ? (
        <PaymentReceiptReview
          key={editing.id}
          receipt={editing}
          controller={controller}
          inbox={inbox}
          onClose={() => setEditing(null)}
        />
      ) : null}
    </>
  );
}
