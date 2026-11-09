import { useMemo } from "react";
import { Button } from "@mantine/core";
import {
  quickEntryTemplates,
  type BillRecord,
  type Ledger,
} from "@hamster-ledger/core";
export function QuickEntryTemplates({
  ledger,
  onSelect,
}: {
  ledger: Ledger;
  onSelect: (record: BillRecord) => void;
}): React.JSX.Element | null {
  const templates = useMemo(() => quickEntryTemplates(ledger), [ledger]);
  if (!templates.length) return null;
  return (
    <div
      className="quick-entry-templates"
      role="group"
      aria-label="常用交易快捷填入"
    >
      {templates.map((item) => (
        <Button
          key={item.id}
          variant="subtle"
          type="button"
          onClick={() => onSelect(item)}
        >
          {item.merchant}
        </Button>
      ))}
    </div>
  );
}
