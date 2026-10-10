import { Alert, Button, Checkbox, TextInput, Text } from "@mantine/core";
import { useFinanceForm, type FinanceForm } from "@hamster-ledger/ledger-react";
import type { Ledger } from "@hamster-ledger/core";
import { useNetworkClient } from "../../hooks/useNetworkController";
import { Dialog } from "../Dialog";
import { Choice } from "../../ui/Choice";
import { DateField } from "../../ui/DateField";
export function FinanceFormDialog({
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
    client: useNetworkClient(),
  });
  return (
    <Dialog title={form.title} onClose={onClose}>
      <form
        onSubmit={(event) => {
          event.preventDefault();
          void controller.save();
        }}
      >
        <div className="form-grid">
          {form.fields
            .filter(
              (field) => !field.visible || field.visible(controller.values),
            )
            .map((field) => {
              const current = String(controller.values[field.key] ?? "");
              return (
                <div
                  key={field.key}
                  className={field.type === "toggle" ? "full-width" : undefined}
                >
                  {field.type === "toggle" ? (
                    <Checkbox
                      label={field.label}
                      checked={Boolean(controller.values[field.key])}
                      onChange={(event) =>
                        controller.change(
                          field.key,
                          event.currentTarget.checked,
                        )
                      }
                    />
                  ) : field.type === "choice" ? (
                    <Choice
                      label={field.label}
                      value={current}
                      onChange={(value) => controller.change(field.key, value)}
                    >
                      {field.options?.map((option) => (
                        <option key={option.value} value={option.value}>
                          {option.label}
                        </option>
                      ))}
                    </Choice>
                  ) : field.type === "date" ? (
                    <DateField
                      label={field.label}
                      type="date"
                      value={current}
                      onChange={(value) => controller.change(field.key, value)}
                    />
                  ) : (
                    <TextInput
                      label={field.label}
                      value={current}
                      inputMode={
                        field.type === "money"
                          ? "decimal"
                          : field.type === "integer"
                            ? "numeric"
                            : "text"
                      }
                      onChange={(event) =>
                        controller.change(field.key, event.currentTarget.value)
                      }
                    />
                  )}
                  {field.hint ? (
                    <Text size="sm" c="dimmed">
                      {field.hint}
                    </Text>
                  ) : null}
                </div>
              );
            })}
        </div>
        {form.fxDateField && controller.values.currency !== "CNY" ? (
          <Button
            variant="outline"
            loading={controller.isBusy}
            onClick={() => void controller.fetchRate()}
          >
            查询当日参考汇率
          </Button>
        ) : null}
        {controller.error ? (
          <Alert color="red" role="alert">
            {controller.error}
          </Alert>
        ) : null}
        <div className="dialog-actions">
          <Button variant="outline" onClick={onClose}>
            取消
          </Button>
          <Button type="submit" loading={controller.isBusy}>
            保存
          </Button>
        </div>
      </form>
    </Dialog>
  );
}
