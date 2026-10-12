import {
  linkedAccountRecords,
  type BillRecord,
  type Ledger,
} from "@hamster-ledger/core";
import { Text } from "react-native-paper";
import { RecordRow } from "./RecordRow";

interface AccountRecordListProps {
  ledger: Ledger;
  accountId: string;
  onRecord: (record: BillRecord) => void;
}
export function AccountRecordList({
  ledger,
  accountId,
  onRecord,
}: AccountRecordListProps): React.JSX.Element {
  const records = linkedAccountRecords({
    records: ledger.records,
    accounts: ledger.accounts,
    accountId,
  })
    .filter((record) => !record.isDeleted)
    .sort((left, right) => right.date.localeCompare(left.date));
  return (
    <>
      {records.map((record) => (
        <RecordRow key={record.id} record={record} onPress={onRecord} />
      ))}
      {!records.length ? <Text>此账户暂无关联流水。</Text> : null}
    </>
  );
}
