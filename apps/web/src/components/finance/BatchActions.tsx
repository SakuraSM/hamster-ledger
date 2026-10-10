import { useState } from "react";
import { Button } from "@mantine/core";
import { categoryDefinitions, type Ledger } from "@hamster-ledger/core";
import type { BatchController } from "@hamster-ledger/ledger-react";
import { Choice } from "../../ui/Choice";
export function BatchActions({
  ledger,
  batch,
  onSelectAll,
}: {
  ledger: Ledger;
  batch: BatchController;
  onSelectAll: () => void;
}): React.JSX.Element {
  const [category, setCategory] = useState(""),
    [confirmDelete, setConfirmDelete] = useState(false);
  return (
    <div className="panel" aria-label="批量整理账单">
      <div className="report-controls">
        <Button variant="subtle" onClick={onSelectAll} disabled={batch.isBusy}>
          选择当前筛选结果
        </Button>
        <span>已选 {batch.selected.length} 笔</span>
        <Button
          variant="subtle"
          onClick={() => {
            batch.clear();
            setConfirmDelete(false);
          }}
          disabled={!batch.selected.length || batch.isBusy}
        >
          清空选择
        </Button>
        <Choice label="批量修改分类" value={category} onChange={setCategory}>
          <option value="">选择分类</option>
          {[
            ...new Set(
              categoryDefinitions(ledger)
                .filter((item) => !item.isArchived)
                .map((item) => item.name),
            ),
          ].map((name) => (
            <option key={name}>{name}</option>
          ))}
        </Choice>
        <Button
          variant="outline"
          disabled={!category || !batch.selected.length || batch.isBusy}
          onClick={() => void batch.apply("category", category)}
        >
          应用分类
        </Button>
        <Button
          color="red"
          variant="subtle"
          disabled={!batch.selected.length || batch.isBusy}
          onClick={() => setConfirmDelete(true)}
        >
          批量删除
        </Button>
      </div>
      {confirmDelete && batch.selected.length ? (
        <p role="alert">
          将删除已选 {batch.selected.length} 笔，可通过撤销恢复。
          <Button
            color="red"
            disabled={batch.isBusy}
            onClick={() => {
              setConfirmDelete(false);
              void batch.apply("delete");
            }}
          >
            确认删除所选
          </Button>
          <Button variant="subtle" onClick={() => setConfirmDelete(false)}>
            取消
          </Button>
        </p>
      ) : null}
      {batch.error ? (
        <p role="alert" className="error-message">
          {batch.error}
        </p>
      ) : null}
    </div>
  );
}
