import { useState } from "react";
import { Button, TextInput } from "@mantine/core";
import { useSavedFilters } from "@hamster-ledger/ledger-react";
import {
  savedTransactionFilterSchema,
  UNASSIGNED_ACCOUNT_FILTER,
  type TransactionFilter,
  type SavedTransactionView,
} from "@hamster-ledger/core";
import { protectedStore } from "../../platform/browser/vault";
export function SavedFilters({
  bookId,
  filter,
  position,
  onApply,
  restoreLast,
}: {
  bookId: string;
  filter: TransactionFilter;
  position: number;
  onApply: (view: SavedTransactionView) => void;
  restoreLast: boolean;
}): React.JSX.Element {
  const [name, setName] = useState("");
  const saved = useSavedFilters({
    store: protectedStore,
    bookId,
    filter,
    position,
    onApply,
    restoreLast,
  });
  return (
    <section aria-label="筛选方案" className="panel">
      <div className="button-row">
        <Button
          variant="subtle"
          onClick={() =>
            onApply({
              filter: savedTransactionFilterSchema.parse({
                reimbursement: "pending",
              }),
              position: 0,
            })
          }
        >
          待报销
        </Button>
        <Button
          variant="subtle"
          onClick={() =>
            onApply({
              filter: savedTransactionFilterSchema.parse({
                accountId: UNASSIGNED_ACCOUNT_FILTER,
              }),
              position: 0,
            })
          }
        >
          未关联账户
        </Button>
        <TextInput
          label="筛选方案名称"
          placeholder="例如：家庭日常开支"
          value={name}
          maxLength={40}
          onChange={(event) => setName(event.target.value)}
        />
        <Button
          variant="outline"
          disabled={!saved.ready || !name.trim()}
          onClick={() => void saved.save(name)}
        >
          保存当前筛选
        </Button>
      </div>
      {saved.presets.map((item) => (
        <div key={item.name} className="button-row">
          <Button
            variant="subtle"
            onClick={() => onApply({ filter: item.filter, position: 0 })}
          >
            {item.name}
          </Button>
          <Button
            variant="subtle"
            aria-label={`删除筛选方案 ${item.name}`}
            onClick={() => void saved.remove(item.name)}
          >
            删除
          </Button>
        </div>
      ))}
      {saved.error && <p role="alert">{saved.error}</p>}
    </section>
  );
}
