import { useState } from "react";
import {
  categoryDefinitions,
  saveCategory,
  moveCategory,
  type Ledger,
  type CategoryDefinition,
} from "@hamster-ledger/core";
import { newEntityId } from "../../platform/browser/runtime";
interface Props {
  ledger: Ledger;
  onCommit: (ledger: Ledger) => Promise<void>;
}
export function CategoriesPanel({
  ledger,
  onCommit,
}: Props): React.JSX.Element {
  const [name, setName] = useState("");
  const [kind, setKind] = useState<CategoryDefinition["kind"]>("支出");
  const [editing, setEditing] = useState<string | null>(null);
  const [error, setError] = useState("");
  const categories = categoryDefinitions(ledger);
  async function commit(next: Ledger): Promise<void> {
    try {
      await onCommit(next);
      setError("");
    } catch (cause) {
      setError(cause instanceof Error ? cause.message : "保存失败");
    }
  }
  async function submit(
    event: React.SubmitEvent<HTMLFormElement>,
  ): Promise<void> {
    event.preventDefault();
    try {
      const current = categories.find((category) => category.id === editing);
      const next = saveCategory(ledger, {
        id: editing ?? newEntityId(),
        name,
        kind,
        order: current?.order ?? categories.length,
        isArchived: current?.isArchived,
      });
      await onCommit(next);
      setName("");
      setEditing(null);
      setError("");
    } catch (cause) {
      setError(cause instanceof Error ? cause.message : "保存失败");
    }
  }
  return (
    <section className="panel">
      <h2>分类管理</h2>
      <form className="inline-form" onSubmit={submit}>
        <label>
          分类名称
          <input
            required
            maxLength={30}
            value={name}
            onChange={(event) => setName(event.target.value)}
          />
        </label>
        <label>
          类型
          <select
            value={kind}
            onChange={(event) =>
              setKind(event.target.value === "收入" ? "收入" : "支出")
            }
          >
            <option>支出</option>
            <option>收入</option>
          </select>
        </label>
        <button className="secondary-button">
          {editing ? "保存分类" : "添加分类"}
        </button>
        {editing ? (
          <button
            type="button"
            className="text-button"
            onClick={() => {
              setEditing(null);
              setName("");
            }}
          >
            取消
          </button>
        ) : null}
      </form>
      <details>
        <summary>管理 {categories.length} 个分类</summary>
        <div className="category-chips">
          {categories.map((category, index) => (
            <div key={category.id}>
              <span>
                {category.name} · {category.kind}
                {category.isArchived ? " · 已归档" : ""}
              </span>
              <div className="button-row">
                <button
                  className="text-button"
                  aria-label={`上移${category.name}`}
                  disabled={index === 0}
                  onClick={() =>
                    void commit(
                      moveCategory(ledger, { id: category.id, direction: -1 }),
                    )
                  }
                >
                  ↑
                </button>
                <button
                  className="text-button"
                  aria-label={`下移${category.name}`}
                  disabled={index === categories.length - 1}
                  onClick={() =>
                    void commit(
                      moveCategory(ledger, { id: category.id, direction: 1 }),
                    )
                  }
                >
                  ↓
                </button>
                <button
                  className="text-button"
                  onClick={() => {
                    setEditing(category.id);
                    setName(category.name);
                    setKind(category.kind);
                  }}
                >
                  改名
                </button>
                <button
                  className="text-button"
                  onClick={() =>
                    void commit(
                      saveCategory(ledger, {
                        ...category,
                        isArchived: !category.isArchived,
                      }),
                    )
                  }
                >
                  {category.isArchived ? "恢复" : "归档"}
                </button>
              </div>
            </div>
          ))}
        </div>
      </details>
      <p className="muted">
        改名会同步更新历史账单、预算与规则。归档保留历史分类。
      </p>
      {error ? (
        <p className="error-message" role="alert">
          {error}
        </p>
      ) : null}
    </section>
  );
}
