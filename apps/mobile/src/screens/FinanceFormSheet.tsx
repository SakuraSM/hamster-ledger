import { View } from "react-native";
import { Button, Checkbox, TextInput, Text } from "react-native-paper";
import { useFinanceForm, type FinanceForm } from "@hamster-ledger/ledger-react";
import type { Ledger } from "@hamster-ledger/core";
import { useNativeAccount } from "../auth/NativeAccount";
import { FormSheet } from "../ui/FormSheet";
import { ChoiceField } from "../ui/ChoiceField";
import { DateField } from "../ui/DateField";
import { ErrorMessage } from "../ui/Screen";
export function FinanceFormSheet({
  form,
  ledger,
  onSave,
  onClose,
}: {
  form: FinanceForm;
  ledger: Ledger;
  onSave: (ledger: Ledger) => Promise<void>;
  onClose: () => void;
}): React.JSX.Element {
  const controller = useFinanceForm({
    form,
    ledger,
    onSave,
    onClose,
    client: useNativeAccount().client,
  });
  return (
    <FormSheet
      title={form.title}
      onClose={onClose}
      hasUnsavedChanges={
        JSON.stringify(controller.values) !== JSON.stringify(form.initial)
      }
    >
      {form.fields
        .filter((field) => !field.visible || field.visible(controller.values))
        .map((field) => {
          const current = String(controller.values[field.key] ?? "");
          return (
            <View key={field.key} style={{ gap: 8 }}>
              {field.type === "toggle" ? (
                <Checkbox.Item
                  label={field.label}
                  status={
                    controller.values[field.key] ? "checked" : "unchecked"
                  }
                  onPress={() =>
                    controller.change(field.key, !controller.values[field.key])
                  }
                />
              ) : field.type === "choice" ? (
                <ChoiceField
                  label={field.label}
                  value={current}
                  options={field.options ?? []}
                  onChange={(value) => controller.change(field.key, value)}
                />
              ) : field.type === "date" ? (
                <DateField
                  label={field.label}
                  value={current}
                  onChange={(value) => controller.change(field.key, value)}
                />
              ) : (
                <TextInput
                  label={field.label}
                  value={current}
                  keyboardType={
                    field.type === "money"
                      ? "decimal-pad"
                      : field.type === "integer"
                        ? "number-pad"
                        : "default"
                  }
                  onChangeText={(value) => controller.change(field.key, value)}
                />
              )}
              {field.hint ? <Text>{field.hint}</Text> : null}
            </View>
          );
        })}
      {form.fxDateField && controller.values.currency !== "CNY" ? (
        <Button
          loading={controller.isBusy}
          onPress={() => void controller.fetchRate()}
        >
          查询当日参考汇率
        </Button>
      ) : null}
      <ErrorMessage message={controller.error} />
      <Button
        mode="contained"
        loading={controller.isBusy}
        disabled={controller.isBusy}
        onPress={() => void controller.save()}
      >
        保存
      </Button>
    </FormSheet>
  );
}
