import { Button, Group, Stack, Text, TextInput } from "@mantine/core";
import { useState } from "react";
import type { Currency } from "@hamster-ledger/core";
import type { ExchangeRatesController } from "@hamster-ledger/ledger-react";
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
    <details className="panel">
      <summary>估值汇率（原币 1 单位折合人民币）</summary>
      <Stack>
        {controller.isLoading ? <Text>正在获取参考汇率…</Text> : null}
        {controller.error ? <Text role="alert">{controller.error}</Text> : null}
        {[...new Set(currencies)]
          .filter((currency) => currency !== "CNY")
          .map((currency) => {
            const rate = controller.rates.find(
              (item) => item.currency === currency,
            );
            return (
              <Group key={currency} align="end">
                <TextInput
                  label={currency}
                  placeholder={rate?.rate ?? "请填写汇率"}
                  value={manual[currency] ?? ""}
                  onChange={(event) =>
                    setManual({
                      ...manual,
                      [currency]: event.currentTarget.value,
                    })
                  }
                  inputMode="decimal"
                />
                <Button
                  variant="outline"
                  disabled={!manual[currency]}
                  onClick={() =>
                    controller.setManual(currency, manual[currency])
                  }
                >
                  使用手动汇率
                </Button>
                <Text size="sm">
                  {rate
                    ? `${rate.rate} · ${rate.date} · ${rate.source === "manual" ? "手动" : rate.isCached ? "缓存参考" : "Frankfurter 参考"}`
                    : "未估值"}
                </Text>
              </Group>
            );
          })}
        <Text size="sm">估值汇率只用于当前资产视图，不改写历史收支。</Text>
      </Stack>
    </details>
  );
}
