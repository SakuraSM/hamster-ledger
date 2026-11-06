import { DATE_KEY_LENGTH } from "../constants";
import { useRef, useState } from "react";
import { StyleSheet, View } from "react-native";
import { Button, Text, TextInput, useTheme } from "react-native-paper";
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
import {
  assetBookKey,
  assetCommitOptions,
  type AssetCommitOptions,
} from "./asset-archive";

interface BalanceCalibrationProps {
  controller: LedgerController;
  account: AssetAccount;
  date: string;
  onClose: () => void;
  onFindRecords: () => void;
}
export function BalanceCalibration({
  controller,
  account,
  date,
  onClose,
  onFindRecords,
}: BalanceCalibrationProps): React.JSX.Element {
  const theme = useTheme();
  const [isReviewing, setReviewing] = useState(false);
  const [previewError, setPreviewError] = useState("");
  const [hasTouchedAmount, setTouchedAmount] = useState(false);
  const [expectedBookKey] = useState(() => assetBookKey(controller));
  const [previewOptions, setPreviewOptions] = useState<
    AssetCommitOptions | undefined
  >(undefined);
  const now = localNow();
  const form = useBalanceCalibration({
    ledger: controller.ledger,
    account,
    initialAt:
      date === now.slice(0, DATE_KEY_LENGTH) ? now : date + " 23:59:59",
    now: localNow,
    onSave: async (value) => {
      if (assetBookKey(controller) !== expectedBookKey)
        throw new Error("账本已切换，请重新打开账户后确认。");
      if (controller.network?.revision !== previewOptions?.expectedRevision)
        throw new Error("账本版本已变化，请返回修改并重新预览。");
      const next = saveAssetAccount({
        ledger: controller.ledger,
        ...value,
        now: localNow(),
        checkpointId: newEntityId(),
      });
      if (previewOptions) await controller.commit(next, previewOptions);
      else await controller.commit(next);
    },
    onClose,
  });
  const initial = useRef({ amount: form.amount, at: form.at, note: form.note });
  const hasUnsavedChanges =
    form.amount !== initial.current.amount ||
    form.at !== initial.current.at ||
    form.note !== initial.current.note;
  const amount = (minor: number): string =>
    formatCurrency({ minor, currency: account.currency ?? "CNY" });
  function review(): void {
    if (assetBookKey(controller) !== expectedBookKey) {
      setPreviewError("账本已切换，请重新打开账户后确认。");
      return;
    }
    if (
      !form.preview ||
      (form.preview.expected === null && !hasTouchedAmount)
    ) {
      setPreviewError("请输入有效的实际余额。");
      return;
    }
    try {
      setPreviewOptions(assetCommitOptions(controller));
      setPreviewError("");
      setReviewing(true);
    } catch (cause) {
      setPreviewError(
        cause instanceof Error ? cause.message : "无法读取账本版本。",
      );
    }
  }
  return (
    <FormSheet
      title="校准账户余额"
      onClose={onClose}
      hasUnsavedChanges={hasUnsavedChanges}
    >
      {isReviewing && form.preview ? (
        <>
          <Text
            variant="headlineMedium"
            accessibilityRole="header"
            style={styles.strong}
          >
            先确认余额差额
          </Text>
          <Text>{account.name} · 新余额基准预览</Text>
          <View
            style={[
              styles.metrics,
              { borderColor: theme.colors.outlineVariant },
            ]}
          >
            <View style={styles.metric}>
              <Text style={{ color: theme.colors.onSurfaceVariant }}>
                当前计算余额
              </Text>
              <Text variant="titleLarge" style={styles.strong}>
                {form.preview.expected === null
                  ? "尚无基准"
                  : amount(form.preview.expected)}
              </Text>
            </View>
            <View style={styles.metric}>
              <Text style={{ color: theme.colors.onSurfaceVariant }}>
                核对实际余额
              </Text>
              <Text variant="titleLarge" style={styles.strong}>
                {amount(form.preview.actual)}
              </Text>
            </View>
          </View>
          <View
            style={[
              styles.notice,
              { backgroundColor: theme.colors.surfaceVariant },
            ]}
          >
            <Text variant="titleMedium">
              校准差额{" "}
              {form.preview.difference === null
                ? "尚无基准"
                : `${form.preview.difference >= 0 ? "+" : ""}${amount(form.preview.difference)}`}
            </Text>
            <Text>保存新基准不会产生收入或支出，旧基准与原始流水仍保留。</Text>
          </View>
          <Text>生效时间 {form.at}</Text>
          <Text>校准原因 {form.note.trim() || "核对实际余额"}</Text>
          <ErrorMessage message={form.error} />
          <Button
            mode="contained"
            contentStyle={styles.touch}
            loading={form.isSaving}
            disabled={form.isSaving}
            onPress={() => void form.save()}
          >
            确认保存新基准
          </Button>
          <Button
            contentStyle={styles.touch}
            onPress={() => setReviewing(false)}
          >
            返回修改
          </Button>
          <Button contentStyle={styles.touch} onPress={onFindRecords}>
            先查找遗漏的账单
          </Button>
        </>
      ) : (
        <>
          <Text
            variant="headlineMedium"
            accessibilityRole="header"
            style={styles.strong}
          >
            核对实际余额
          </Text>
          <Text>{account.name} · 差额只调整资产，不记作收入或支出。</Text>
          <TextInput
            mode="outlined"
            label={account.kind === "liability" ? "实际负债" : "实际余额"}
            accessibilityLabel={
              account.kind === "liability" ? "实际负债" : "实际余额"
            }
            value={form.amount}
            onChangeText={(value) => {
              form.setAmount(value);
              setTouchedAmount(true);
              setPreviewError("");
            }}
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
            accessibilityLabel="校准说明"
            value={form.note}
            onChangeText={form.setNote}
          />
          <Text>
            保留原有余额历史，确认时间之后的流水继续累计。负债填正数，信用卡预存款填负数。
          </Text>
          <ErrorMessage message={previewError} />
          <Button mode="contained" contentStyle={styles.touch} onPress={review}>
            查看校准差额
          </Button>
        </>
      )}
    </FormSheet>
  );
}
const styles = StyleSheet.create({
  metrics: {
    flexDirection: "row",
    flexWrap: "wrap",
    gap: 16,
    paddingVertical: 16,
    borderBottomWidth: StyleSheet.hairlineWidth,
  },
  metric: { flexGrow: 1, gap: 6 },
  notice: { borderRadius: 12, padding: 16, gap: 8 },
  strong: { fontWeight: "700" },
  touch: { minHeight: 48 },
});
