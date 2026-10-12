import { MINUTE_TIMESTAMP_LENGTH } from "../constants";
import { List } from "react-native-paper";
import { signedMoney, type BillRecord } from "@hamster-ledger/core";
import { AmountText, useAmountColors } from "../ui/AmountText";
import { recordAmountTone } from "../ui/amount-tones";
interface RecordRowProps {
  record: BillRecord;
  onPress: (record: BillRecord) => void;
}
const STATUS_LABEL = {
  confirmed: "已入账",
  pending: "待确认",
  duplicate: "重复",
};
export function RecordRow({
  record,
  onPress,
}: RecordRowProps): React.JSX.Element {
  const tone = recordAmountTone(record);
  const colors = useAmountColors();
  return (
    <List.Item
      title={record.merchant}
      description={`${record.date.slice(0, MINUTE_TIMESTAMP_LENGTH)} · ${record.category}\n${record.isDeleted ? "回收站" : STATUS_LABEL[record.status]} · ${record.source}`}
      descriptionNumberOfLines={2}
      onPress={() => onPress(record)}
      accessibilityLabel={`${record.merchant}，${record.kind}，${signedMoney(record)}，${STATUS_LABEL[record.status]}`}
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
          style={{ alignSelf: "center" }}
        >
          {signedMoney(record)}
        </AmountText>
      )}
    />
  );
}
