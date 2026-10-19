import { DATE_KEY_LENGTH } from "../constants";
import { View } from "react-native";
import { Button, Text } from "react-native-paper";
import {
  projectAccountBalance,
  formatCurrency,
  type AssetAccount,
  type Ledger,
  type BillRecord,
} from "@hamster-ledger/core";
import { FormSheet } from "../ui/FormSheet";
import { Section, styles } from "../ui/Screen";
import { AccountRecordList } from "./AccountRecordList";
interface AssetAccountDetailProps {
  account: AssetAccount;
  ledger: Ledger;
  through: string;
  isSaving: boolean;
  onClose: () => void;
  onEdit: () => void;
  onCalibrate: () => void;
  onTransfer: () => void;
  onArchive: () => void;
  onRecord: (record: BillRecord) => void;
}
export function AssetAccountDetail({
  account,
  ledger,
  through,
  isSaving,
  onClose,
  onEdit,
  onCalibrate,
  onTransfer,
  onArchive,
  onRecord,
}: AssetAccountDetailProps): React.JSX.Element {
  const balance = projectAccountBalance({ account, ledger, through });
  const amount = (minor: number): string =>
    formatCurrency({ minor, currency: account.currency ?? "CNY" });
  const label =
    account.kind === "asset"
      ? "账户余额"
      : balance.balance < 0
        ? "预存余额"
        : "剩余负债";
  return (
    <FormSheet title={account.name} onClose={onClose}>
      <Text>
        {label} · 截至 {through.slice(0, DATE_KEY_LENGTH)}
      </Text>
      <Text variant="headlineLarge">
        {balance.baseline
          ? amount(
              account.kind === "liability"
                ? Math.abs(balance.balance)
                : balance.balance,
            )
          : "尚无余额基准"}
      </Text>
      {balance.baseline ? (
        <>
          <Text>
            基准 {amount(balance.baseline.balance)} · {balance.baseline.at}
          </Text>
          <Text>
            之后变动 {balance.change >= 0 ? "+" : ""}
            {amount(balance.change)} · {balance.movementCount} 笔
          </Text>
        </>
      ) : null}
      <View style={styles.row}>
        <Button mode="contained" onPress={onCalibrate}>
          校准余额
        </Button>
        {!account.isArchived ? (
          <Button mode="outlined" onPress={onTransfer}>
            {account.kind === "liability" ? "还款" : "转账"}
          </Button>
        ) : null}
        <Button onPress={onEdit}>编辑账户</Button>
      </View>
      <Section title="账户明细">
        <AccountRecordList
          ledger={ledger}
          account={account}
          through={through}
          onRecord={onRecord}
        />
      </Section>
      <Text>匹配别名：{account.aliases.join("、") || "无"}</Text>
      <Button disabled={isSaving} onPress={onArchive}>
        {account.isArchived ? "恢复账户" : "归档账户"}
      </Button>
      <Text variant="bodySmall">
        归档保留历史流水，操作后可撤销。已归档账户不计入净资产。
      </Text>
    </FormSheet>
  );
}
