import type { Currency } from "@hamster-ledger/core";
import type { ExchangeRatesController } from "@hamster-ledger/ledger-react";
import { DateField } from "../ui/DateField";
import { FormSheet } from "../ui/FormSheet";
import { ValuationRates } from "./ValuationRates";

interface AssetValuationDialogProps {
  value: string;
  currencies: Currency[];
  rates: ExchangeRatesController;
  onChange: (value: string) => void;
  onClose: () => void;
}
export function AssetValuationDialog({
  value,
  currencies,
  rates,
  onChange,
  onClose,
}: AssetValuationDialogProps): React.JSX.Element {
  return (
    <FormSheet title="估值日与汇率" onClose={onClose}>
      <DateField label="资产估值日" value={value} onChange={onChange} />
      <ValuationRates controller={rates} currencies={currencies} />
    </FormSheet>
  );
}
