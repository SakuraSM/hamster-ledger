import { Button, Text } from "react-native-paper";
import type { BillRecord } from "@hamster-ledger/core";
import { FormSheet } from "../ui/FormSheet";
import { RecordRow } from "./RecordRow";

interface AssetUnassignedProps {
  records: BillRecord[];
  isAmountHidden: boolean;
  onReveal: () => void;
  onClose: () => void;
  onRecord: (record: BillRecord) => void;
}
export function AssetUnassigned({
  records,
  isAmountHidden,
  onReveal,
  onClose,
  onRecord,
}: AssetUnassignedProps): React.JSX.Element {
  return (
    <FormSheet title="未关联账户的账单" onClose={onClose}>
      <Text>
        这些已确认账单尚未关联资产账户，因此不会计入账户余额。打开账单后可编辑账户。
      </Text>
      {isAmountHidden ? (
        <Button contentStyle={{ minHeight: 48 }} onPress={onReveal}>
          显示资产金额后查看账单
        </Button>
      ) : records.length ? (
        records.map((record) => (
          <RecordRow key={record.id} record={record} onPress={onRecord} />
        ))
      ) : (
        <Text>没有待关联的账单。</Text>
      )}
    </FormSheet>
  );
}
