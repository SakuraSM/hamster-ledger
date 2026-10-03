import { TextInput, Button } from "@mantine/core";
import { Choice } from "../../ui/Choice";
import { useState } from "react";
import {
  CATEGORY_TEMPLATES,
  applyCategoryTemplate,
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
  const [parentId, setParentId] = useState("");
  const [template, setTemplate] =
    useState<keyof typeof CATEGORY_TEMPLATES>("daily");
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
        parentId: parentId || null,
        order: current?.order ?? categories.length,
        isArchived: current?.isArchived,
      });
      await onCommit(next);
      setName("");
      setParentId("");
      setEditing(null);
      setError("");
    } catch (cause) {
      setError(cause instanceof Error ? cause.message : "保存失败");
    }
  }
  return (
    <section className="panel">
      <h2>分类管理</h2>
      <div className="inline-form">
        <Choice
          label="分类模板"
          value={template}
          onChange={(value) => setTemplate(value as typeof template)}
        >
          {Object.entries(CATEGORY_TEMPLATES).map(([value, label]) => (
            <option value={value} key={value}>
              {label}
            </option>
          ))}
        </Choice>
        <Button
          variant="outline"
          onClick={() => void commit(applyCategoryTemplate(ledger, template))}
        >
          应用所选模板
        </Button>
      </div>
      <p className="muted">模板仅补充缺少的分类，不覆盖现有名称和层级。</p>
      <form className="inline-form" onSubmit={submit}>
        <TextInput
          label={<>分类名称</>}
          required
          maxLength={30}
          value={name}
          onChange={(event) => setName(event.target.value)}
        />
        <Choice
          label={<>类型</>}
          value={kind}
          onChange={(value) => setKind(value === "收入" ? "收入" : "支出")}
        >
          <option>支出</option>
          <option>收入</option>
        </Choice>
        <Choice label="父分类" value={parentId} onChange={setParentId}>
          <option value="">一级分类</option>
          {categories
            .filter(
              (item) =>
                !item.parentId &&
                !item.isArchived &&
                item.kind === kind &&
                item.id !== editing,
            )
            .map((item) => (
              <option key={item.id} value={item.id}>
                {item.name}
              </option>
            ))}
        </Choice>
        <Button variant="outline" type="submit" className="secondary-button">
          {editing ? "保存分类" : "添加分类"}
        </Button>
        {editing ? (
          <Button
            variant="subtle"
            type="button"
            className="text-button"
            onClick={() => {
              setEditing(null);
              setName("");
            }}
          >
            取消
          </Button>
        ) : null}
      </form>
      <details>
        <summary>管理 {categories.length} 个分类</summary>
        <div className="category-chips">
          {categories.map((category, index) => (
            <div key={category.id}>
              <span>
                {category.parentId
                  ? `${categories.find((item) => item.id === category.parentId)?.name} / `
                  : ""}
                {category.name} · {category.kind}
                {category.isArchived ? " · 已归档" : ""}
              </span>
              <div className="button-row">
                <Button
                  variant="subtle"
                  type="submit"
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
                </Button>
                <Button
                  variant="subtle"
                  type="submit"
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
                </Button>
                <Button
                  variant="subtle"
                  type="submit"
                  className="text-button"
                  onClick={() => {
                    setEditing(category.id);
                    setName(category.name);
                    setKind(category.kind);
                    setParentId(category.parentId ?? "");
                  }}
                >
                  改名
                </Button>
                <Button
                  variant="subtle"
                  type="submit"
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
                </Button>
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
