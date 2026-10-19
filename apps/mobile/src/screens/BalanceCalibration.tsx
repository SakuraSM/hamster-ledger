import { DATE_KEY_LENGTH } from "../constants";
import { Button, Card, Text, TextInput } from "react-native-paper";
import {
  formatCurrency,
  saveAssetAccount,
  type AssetAccount,
} from "@hamster-ledger/core";
import {
  useBalanceCalibration,
  type LedgerController,
} from "@hamster-ledger/ledger-react";
import { localNow, newEntityId } from "../platform/runtime";
import { FormSheet } from "../ui/FormSheet";
import { DateField } from "../ui/DateField";
import { ErrorMessage } from "../ui/Screen";
interface BalanceCalibrationProps {
  controller: LedgerController;
  account: AssetAccount;
  date: string;
  onClose: () => void;
}
export function BalanceCalibration({
  controller,
  account,
  date,
  onClose,
}: BalanceCalibrationProps): React.JSX.Element {
  const now = localNow();
  const form = useBalanceCalibration({
    ledger: controller.ledger,
    account,
    initialAt:
      date === now.slice(0, DATE_KEY_LENGTH) ? now : date + " 23:59:59",
    now: localNow,
    onSave: async (value) => {
      await controller.commit(
        saveAssetAccount({
          ledger: controller.ledger,
          ...value,
          now: localNow(),
          checkpointId: newEntityId(),
        }),
      );
    },
    onClose,
  });
  const amount = (minor: number): string =>
    formatCurrency({ minor, currency: account.currency ?? "CNY" });
  return (
    <FormSheet title="校准账户余额" onClose={onClose}>
      <Text variant="titleLarge">{account.name}</Text>
      <Text>核对实际余额。差额只调整资产，不记作收入或支出。</Text>
      <TextInput
        mode="outlined"
        label={account.kind === "liability" ? "实际负债" : "实际余额"}
        value={form.amount}
        onChangeText={form.setAmount}
        keyboardType="numbers-and-punctuation"
      />
      <DateField
        label="余额确认时间"
        value={form.at}
        withTime
        onChange={form.setAt}
      />
      <TextInput
        mode="outlined"
        label="校准说明"
        value={form.note}
        onChangeText={form.setNote}
      />
      <Card mode="contained">
        <Card.Content style={{ gap: 8 }}>
          <Text>
            账面余额{" "}
            {form.preview?.expected == null
              ? "尚无基准"
              : amount(form.preview.expected)}
          </Text>
          <Text>
            校准差额{" "}
            {form.preview?.difference == null
              ? "—"
              : `${form.preview.difference >= 0 ? "+" : ""}${amount(form.preview.difference)}`}
          </Text>
          <Text variant="titleLarge">
            校准后 {form.preview ? amount(form.preview.actual) : "—"}
          </Text>
        </Card.Content>
      </Card>
      <Text variant="bodySmall">
        保留原有余额历史。确认时间之后的流水继续累计；负债填正数，信用卡预存款填负数。
      </Text>
      <ErrorMessage message={form.error} />
      <Button
        mode="contained"
        loading={form.isSaving}
        disabled={form.isSaving}
        onPress={() => void form.save()}
      >
        确认校准
      </Button>
    </FormSheet>
  );
}
