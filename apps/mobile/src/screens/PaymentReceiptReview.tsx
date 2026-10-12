import { DATE_KEY_LENGTH } from "../constants";
import { PaymentReceiptRecovery } from "./PaymentReceiptRecovery";
import { useMemo, useState } from "react";
import { Button, Checkbox, List, Text } from "react-native-paper";
import {
  parsePaymentNotification,
  paymentEditedEntry,
  paymentAmountString,
  paymentReceiptRecord,
  paymentNotificationMatches,
  PAYMENT_RECORD_PREFIX,
  signedMoney,
  type Ledger,
  type PaymentReceipt,
  type BillRecord,
} from "@hamster-ledger/core";
import type {
  LedgerController,
  EntryDraft,
} from "@hamster-ledger/ledger-react";
import type { PaymentInboxController } from "../hooks/usePaymentInbox";
import { AdvancedEntryEditor } from "./AdvancedEntryEditor";
import { ErrorMessage } from "../ui/Screen";
import { localTimestamp } from "../platform/runtime";
interface PaymentReceiptReviewProps {
  receipt: PaymentReceipt;
  controller: LedgerController;
  inbox: PaymentInboxController;
  onClose: () => void;
}
export function PaymentReceiptReview({
  receipt,
  controller,
  inbox,
  onClose,
}: PaymentReceiptReviewProps): React.JSX.Element {
  const candidate = useMemo(
    () =>
      parsePaymentNotification({
        receipt,
        localTimestamp: localTimestamp(receipt.postedAt),
      }),
    [receipt],
  );
  const initialMatches = useMemo(
    () =>
      paymentNotificationMatches({
        ledger: controller.ledger,
        candidate,
        receipt,
      }),
    [controller.ledger, candidate, receipt],
  );
  const [latestMatches, setLatestMatches] = useState<BillRecord[] | null>(null),
    [allowNew, setAllowNew] = useState(false);
  const matches = latestMatches ?? initialMatches;
  const initialDraft: Partial<EntryDraft> = {
    id: PAYMENT_RECORD_PREFIX + receipt.id,
    ...(candidate.type ? { type: candidate.type } : {}),
    amount: candidate.amount,
    merchant: candidate.merchant,
    date: candidate.date,
    accountId: "",
    category: "待分类",
    description: "",
    rate: "1",
    rateDate: candidate.date.slice(0, DATE_KEY_LENGTH),
  };
  async function save(edited: Ledger): Promise<void> {
    const entry = paymentEditedEntry({ ledger: edited, receiptId: receipt.id });
    const original = entry.detail.original;
    const fresh = paymentNotificationMatches({
      ledger: controller.ledger,
      receipt,
      candidate: {
        ...candidate,
        type: entry.detail.type,
        merchant: entry.merchant,
        date: entry.date,
        amount: paymentAmountString(original.minor),
      },
    });
    if (fresh.length && !allowNew) {
      setLatestMatches(fresh);
      throw new Error(
        "存在疑似重复账单。请关联已有记录，或明确勾选仍作为新账单。",
      );
    }
    await inbox.confirm({ receipt, entry, orderId: candidate.orderId });
  }
  async function link(record: BillRecord): Promise<void> {
    if (await inbox.link({ receipt, recordId: record.id })) onClose();
  }
  const intro = (
    <>
      <Text>
        {receipt.source} · 支付通知只提供参考，请核对实付金额和实际账户。
      </Text>
      <List.Accordion title="查看原始支付通知">
        <Text selectable>
          {receipt.title}
          {"\n"}
          {receipt.text}
        </Text>
      </List.Accordion>
      {candidate.issues.map((issue) => (
        <Text key={issue}>• {issue}</Text>
      ))}
      {matches.length ? (
        <>
          <Text variant="titleMedium">
            发现 {matches.length} 笔疑似重复账单
          </Text>
          {matches.map((record) => (
            <Button
              key={record.id}
              disabled={inbox.isBusy}
              onPress={() => void link(record)}
            >
              关联：{record.merchant} · {signedMoney(record)} · {record.date}
            </Button>
          ))}
          <Checkbox.Item
            label="我已核对，仍作为一笔新账单"
            status={allowNew ? "checked" : "unchecked"}
            disabled={inbox.isBusy}
            onPress={() => setAllowNew(!allowNew)}
          />
        </>
      ) : null}
      <ErrorMessage message={inbox.error} />
    </>
  );
  const existing = paymentReceiptRecord({
    ledger: controller.ledger,
    receiptId: receipt.id,
  });
  if (existing)
    return (
      <PaymentReceiptRecovery
        record={existing}
        receipt={receipt}
        inbox={inbox}
        onClose={onClose}
      />
    );
  return (
    <AdvancedEntryEditor
      ledger={controller.ledger}
      initialDraft={initialDraft}
      intro={intro}
      accountCurrency="CNY"
      requiresTypeConfirmation={!candidate.type}
      onSave={save}
      onClose={onClose}
    />
  );
}
