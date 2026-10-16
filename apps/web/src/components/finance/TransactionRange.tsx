import { Button, TextInput } from "@mantine/core";
import { KINDS, type Kind } from "@hamster-ledger/core";
import { Choice } from "../../ui/Choice";
export interface TransactionRangeValue {
  startDate: string;
  endDate: string;
  kind: Kind | "";
}
export const EMPTY_RANGE: TransactionRangeValue = {
  startDate: "",
  endDate: "",
  kind: "",
};
export function TransactionRange({
  value,
  onChange,
  onClear,
}: {
  value: TransactionRangeValue;
  onChange: (value: TransactionRangeValue) => void;
  onClear: () => void;
}): React.JSX.Element {
  return (
    <div className="report-controls transaction-range">
      <TextInput
        type="date"
        label="开始日期"
        description="设置日期会切换到全部月份"
        value={value.startDate}
        onChange={(event) =>
          onChange({ ...value, startDate: event.target.value })
        }
      />
      <TextInput
        type="date"
        label="结束日期"
        value={value.endDate}
        onChange={(event) =>
          onChange({ ...value, endDate: event.target.value })
        }
      />
      <Choice
        label="收支类型"
        value={value.kind}
        onChange={(kind) => onChange({ ...value, kind: kind as Kind | "" })}
      >
        <option value="">全部类型</option>
        {KINDS.map((kind) => (
          <option key={kind}>{kind}</option>
        ))}
      </Choice>
      <Button variant="subtle" onClick={onClear}>
        清除全部筛选
      </Button>
    </div>
  );
}
