import { Button, Text } from "react-native-paper";
import {
  signedMoney,
  type BillRecord,
  type PaymentReceipt,
} from "@hamster-ledger/core";
import type { PaymentInboxController } from "../hooks/usePaymentInbox";
import { FormSheet } from "../ui/FormSheet";
import { ErrorMessage } from "../ui/Screen";
export function PaymentReceiptRecovery({
  record,
  receipt,
  inbox,
  onClose,
}: {
  record: BillRecord;
  receipt: PaymentReceipt;
  inbox: PaymentInboxController;
  onClose: () => void;
}): React.JSX.Element {
  async function finish(): Promise<void> {
    if (await inbox.link({ receipt, recordId: record.id })) onClose();
  }
  return (
    <FormSheet title="支付消息已处理" onClose={onClose}>
      <Text>
        {record.isDeleted
          ? "已有账单位于回收站，不会自动恢复。"
          : "账单已保存，消息状态尚未更新。"}
      </Text>
      <Text>
        {record.merchant} · {signedMoney(record)} · {record.date}
      </Text>
      <Text>此操作只更新本机收件箱状态，不会新增账单或重复计入金额。</Text>
      <ErrorMessage message={inbox.error} />
      <Button
        mode="contained"
        loading={inbox.isBusy}
        disabled={inbox.isBusy}
        onPress={() => void finish()}
      >
        完成消息状态更新
      </Button>
    </FormSheet>
  );
}
