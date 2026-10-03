import { MINUTE_TIMESTAMP_LENGTH } from "../constants";
import { List, Text } from "react-native-paper";
import { signedMoney, type BillRecord } from "@hamster-ledger/core";
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
  return (
    <List.Item
      title={record.merchant}
      description={`${record.date.slice(0, MINUTE_TIMESTAMP_LENGTH)} · ${record.category}\n${record.isDeleted ? "回收站" : STATUS_LABEL[record.status]} · ${record.source}`}
      descriptionNumberOfLines={2}
      onPress={() => onPress(record)}
      accessibilityLabel={`${record.merchant}，${signedMoney(record)}，${STATUS_LABEL[record.status]}`}
      left={(props) => (
        <List.Icon
          {...props}
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
        <Text
          variant="titleMedium"
          style={{ alignSelf: "center", fontVariant: ["tabular-nums"] }}
        >
          {signedMoney(record)}
        </Text>
      )}
    />
  );
}
