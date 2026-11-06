import { useState } from "react";
import { Button, Text, TextInput } from "react-native-paper";
import type { Currency } from "@hamster-ledger/core";
import type { ExchangeRatesController } from "@hamster-ledger/ledger-react";
import { Section, ErrorMessage } from "../ui/Screen";
export function ValuationRates({
  controller,
  currencies,
}: {
  controller: ExchangeRatesController;
  currencies: Currency[];
}): React.JSX.Element | null {
  const [manual, setManual] = useState<Record<string, string>>({});
  if (!currencies.some((currency) => currency !== "CNY")) return null;
  return (
    <Section title="估值汇率">
      <ErrorMessage message={controller.error} />
      {controller.isLoading ? (
        <Text accessibilityLiveRegion="polite">正在查询参考汇率…</Text>
      ) : null}
      {[...new Set(currencies)]
        .filter((currency) => currency !== "CNY")
        .map((currency) => {
          const rate = controller.rates.find(
            (item) => item.currency === currency,
          );
          return (
            <Section key={currency} title={currency}>
              <Text>
                {rate
                  ? `${rate.rate} · ${rate.date} · ${rate.source === "manual" ? "手动" : rate.isCached ? "缓存参考" : "Frankfurter 参考"}`
                  : "缺少汇率，未估值"}
              </Text>
              <TextInput
                label={`1 ${currency} 折合人民币`}
                accessibilityLabel={`1 ${currency} 折合人民币`}
                value={manual[currency] ?? ""}
                onChangeText={(value) =>
                  setManual({ ...manual, [currency]: value })
                }
                keyboardType="decimal-pad"
              />
              <Button
                disabled={!manual[currency]}
                contentStyle={{ minHeight: 48 }}
                onPress={() => controller.setManual(currency, manual[currency])}
              >
                使用手动汇率
              </Button>
            </Section>
          );
        })}
      <Text>
        手动汇率仅用于本次估值查看，不改写历史收支。参考汇率不代表银行结算价格。
      </Text>
    </Section>
  );
}
