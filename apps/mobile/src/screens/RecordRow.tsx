import { memo } from "react";
import { MINUTE_TIMESTAMP_LENGTH } from "../constants";
import { List } from "react-native-paper";
import { signedMoney, type BillRecord } from "@hamster-ledger/core";
import { AmountText, useAmountColors } from "../ui/AmountText";
import { recordAmountTone } from "../ui/amount-tones";
interface RecordRowProps {
  record: BillRecord;
  isAmountHidden?: boolean;
  onPress: (record: BillRecord) => void;
}
const STATUS_LABEL = {
  confirmed: "已入账",
  pending: "待确认",
  duplicate: "重复",
};
export const RecordRow = memo(function RecordRow({
  record,
  isAmountHidden = false,
  onPress,
}: RecordRowProps): React.JSX.Element {
  const tone = recordAmountTone(record);
  const colors = useAmountColors();
  const statusLabel = record.isDeleted ? "回收站" : STATUS_LABEL[record.status];
  return (
    <List.Item
      title={isAmountHidden ? "账单" : record.merchant}
      description={
        isAmountHidden
          ? `${record.date.slice(0, MINUTE_TIMESTAMP_LENGTH)} · ${statusLabel}`
          : `${record.date.slice(0, MINUTE_TIMESTAMP_LENGTH)} · ${record.category}\n${statusLabel} · ${record.source}`
      }
      descriptionNumberOfLines={2}
      onPress={() => onPress(record)}
      accessibilityLabel={
        isAmountHidden
          ? `账单，${record.date.slice(0, MINUTE_TIMESTAMP_LENGTH)}，${record.kind}，金额已隐藏，${statusLabel}`
          : `${record.merchant}，${record.kind}，${signedMoney(record)}，${statusLabel}`
      }
      style={{ minHeight: 72 }}
      left={(props) => (
        <List.Icon
          {...props}
          color={colors[tone]}
          icon={
            record.kind === "收入"
              ? "arrow-down-circle-outline"
              : record.kind === "转账"
                ? "swap-horizontal"
                : "receipt"
          }
        />
      )}
      right={() => (
        <AmountText
          amount={record.amount}
          tone={tone}
          variant="titleMedium"
          isMuted={isAmountHidden}
          style={{ alignSelf: "center" }}
        >
          {isAmountHidden ? "••••" : signedMoney(record)}
        </AmountText>
      )}
    />
  );
});
