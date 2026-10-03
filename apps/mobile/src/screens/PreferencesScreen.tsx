import { DATE_PART_WIDTH } from "../constants";
import { useState } from "react";
import { DateTimePickerAndroid } from "@react-native-community/datetimepicker";
import { Button, Switch, Text, TextInput, List } from "react-native-paper";
import {
  DEFAULT_PREFERENCES,
  preferencesSchema,
  type LedgerPreferences,
} from "@hamster-ledger/core";
import type { LedgerController } from "@hamster-ledger/ledger-react";
import { Screen, ErrorMessage } from "../ui/Screen";
import { ChoiceField } from "../ui/ChoiceField";
import { configureReminder } from "../platform/reminders";
interface PreferencesScreenProps {
  controller: LedgerController;
}
export function PreferencesScreen({
  controller,
}: PreferencesScreenProps): React.JSX.Element {
  const [draft, setDraft] = useState<LedgerPreferences>(
    controller.ledger.preferences ?? DEFAULT_PREFERENCES,
  );
  const [error, setError] = useState("");
  const [isBusy, setIsBusy] = useState(false);
  function update(patch: Partial<LedgerPreferences>): void {
    setDraft((current) => ({ ...current, ...patch }));
  }
  function pickTime(): void {
    const [hours, minutes] = draft.reminderTime.split(":").map(Number);
    const date = new Date();
    date.setHours(hours, minutes, 0, 0);
    DateTimePickerAndroid.open({
      mode: "time",
      value: date,
      is24Hour: true,
      onChange: (event, selected) => {
        if (event.type === "set" && selected)
          update({
            reminderTime: `${String(selected.getHours()).padStart(DATE_PART_WIDTH, "0")}:${String(selected.getMinutes()).padStart(DATE_PART_WIDTH, "0")}`,
          });
      },
    });
  }
  async function save(): Promise<void> {
    setIsBusy(true);
    try {
      const preferences = preferencesSchema.parse(draft);
      await configureReminder(preferences);
      await controller.commit({ ...controller.ledger, preferences });
      setError("");
      controller.notify("偏好已保存");
    } catch (cause) {
      setError(cause instanceof Error ? cause.message : "保存失败");
    } finally {
      setIsBusy(false);
    }
  }
  return (
    <Screen>
      <Text variant="headlineSmall" accessibilityRole="header">
        记账偏好
      </Text>
      <TextInput
        accessibilityLabel="每月账期开始日（1—31）"
        mode="outlined"
        label="每月账期开始日（1—31）"
        value={String(draft.cycleStartDay)}
        keyboardType="number-pad"
        onChangeText={(value) => update({ cycleStartDay: Number(value) })}
      />
      <ChoiceField
        label="主题"
        value={draft.theme}
        onChange={(value) =>
          update({ theme: value as LedgerPreferences["theme"] })
        }
        options={[
          { value: "warm", label: "奶油暖棕" },
          { value: "sage", label: "鼠尾草绿" },
          { value: "night", label: "深夜账本" },
        ]}
      />
      <List.Item
        title="隐藏首页金额"
        right={() => (
          <Switch
            accessibilityLabel="隐藏首页金额"
            value={draft.hideAmounts}
            onValueChange={(value) => update({ hideAmounts: value })}
          />
        )}
      />
      <List.Item
        title="每日记账提醒"
        description="由系统通知提醒，无需保持应用打开"
        right={() => (
          <Switch
            accessibilityLabel="每日记账提醒"
            value={draft.reminderEnabled}
            onValueChange={(value) => update({ reminderEnabled: value })}
          />
        )}
      />
      <Button mode="outlined" icon="clock-outline" onPress={pickTime}>
        提醒时间：{draft.reminderTime}
      </Button>
      <Text>设备的省电设置可能推迟提醒。通知不包含账单金额和账户内容。</Text>
      <ErrorMessage message={error} />
      <Button
        mode="contained"
        loading={isBusy}
        disabled={isBusy}
        onPress={() => void save()}
      >
        保存偏好
      </Button>
    </Screen>
  );
}
