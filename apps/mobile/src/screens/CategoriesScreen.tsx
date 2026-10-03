import { ChoiceField } from "../ui/ChoiceField";
import { useState } from "react";
import {
  Button,
  Text,
  TextInput,
  SegmentedButtons,
  Card,
} from "react-native-paper";
import {
  CATEGORY_TEMPLATES,
  applyCategoryTemplate,
  categoryDefinitions,
  saveCategory,
  moveCategory,
  type CategoryDefinition,
} from "@hamster-ledger/core";
import type { LedgerController } from "@hamster-ledger/ledger-react";
import { Screen, Section, ErrorMessage } from "../ui/Screen";
import { newEntityId } from "../platform/runtime";
interface CategoriesScreenProps {
  controller: LedgerController;
}
export function CategoriesScreen({
  controller,
}: CategoriesScreenProps): React.JSX.Element {
  const [kind, setKind] = useState<"支出" | "收入">("支出");
  const [name, setName] = useState("");
  const [editing, setEditing] = useState<CategoryDefinition | null>(null);
  const [parentId, setParentId] = useState("");
  const [template, setTemplate] =
    useState<keyof typeof CATEGORY_TEMPLATES>("daily");
  const [error, setError] = useState("");
  const categories = categoryDefinitions(controller.ledger);
  async function save(category?: CategoryDefinition): Promise<void> {
    try {
      const input = category ?? {
        id: editing?.id ?? newEntityId(),
        name,
        kind,
        parentId: parentId || null,
        order: editing?.order ?? categories.length,
      };
      await controller.commit(saveCategory(controller.ledger, input));
      setName("");
      setParentId("");
      setEditing(null);
      setError("");
    } catch (cause) {
      setError(cause instanceof Error ? cause.message : "保存分类失败");
    }
  }
  async function move(id: string): Promise<void> {
    try {
      await controller.commit(
        moveCategory(controller.ledger, { id, direction: -1 }),
      );
    } catch (cause) {
      setError(cause instanceof Error ? cause.message : "排序失败");
    }
  }
  return (
    <Screen>
      <Section title="分类模板">
        <ChoiceField
          label="选择模板"
          value={template}
          options={Object.entries(CATEGORY_TEMPLATES).map(([value, label]) => ({
            value,
            label,
          }))}
          onChange={(value) => setTemplate(value as typeof template)}
        />
        <Text>仅补充缺少的分类，不覆盖现有名称和层级。</Text>
        <Button
          onPress={() => {
            void controller
              .commit(applyCategoryTemplate(controller.ledger, template))
              .catch((cause: unknown) =>
                setError(
                  cause instanceof Error ? cause.message : "应用模板失败",
                ),
              );
          }}
        >
          应用所选模板
        </Button>
      </Section>
      <Text variant="headlineSmall" accessibilityRole="header">
        分类管理
      </Text>
      <Text>
        重命名会同步更新历史账单、预算与分类规则，归档会保留历史记录。
      </Text>
      <SegmentedButtons
        value={kind}
        onValueChange={(value) => {
          setKind(value as "支出" | "收入");
          setEditing(null);
          setParentId("");
          setName("");
        }}
        buttons={[
          { value: "支出", label: "支出" },
          { value: "收入", label: "收入" },
        ]}
      />
      <Section title={editing ? "重命名分类" : "新增分类"}>
        <TextInput
          accessibilityLabel="分类名称"
          mode="outlined"
          label="分类名称"
          value={name}
          maxLength={30}
          onChangeText={setName}
        />
        <ChoiceField
          label="父分类"
          value={parentId}
          options={[
            { value: "", label: "一级分类" },
            ...categories
              .filter(
                (item) =>
                  !item.parentId &&
                  !item.isArchived &&
                  item.kind === kind &&
                  item.id !== editing?.id,
              )
              .map((item) => ({ value: item.id, label: item.name })),
          ]}
          onChange={setParentId}
        />
        <Button
          mode="contained"
          disabled={controller.isSaving}
          onPress={() => void save()}
        >
          保存分类
        </Button>
        {editing ? (
          <Button
            onPress={() => {
              setEditing(null);
              setName("");
            }}
          >
            取消编辑
          </Button>
        ) : null}
      </Section>
      <ErrorMessage message={error} />
      {categories
        .filter((category) => category.kind === kind)
        .map((category) => (
          <Card mode="outlined" key={category.id}>
            <Card.Content>
              <Text variant="titleMedium">
                {category.parentId
                  ? `${categories.find((item) => item.id === category.parentId)?.name} / `
                  : ""}
                {category.name}
                {category.isArchived ? " · 已归档" : ""}
              </Text>
              <Button
                onPress={() => {
                  setEditing(category);
                  setName(category.name);
                  setParentId(category.parentId ?? "");
                }}
              >
                重命名
              </Button>
              <Button
                disabled={controller.isSaving}
                onPress={() => void move(category.id)}
              >
                上移
              </Button>
              <Button
                disabled={controller.isSaving}
                onPress={() =>
                  void save({ ...category, isArchived: !category.isArchived })
                }
              >
                {category.isArchived ? "恢复分类" : "归档分类"}
              </Button>
            </Card.Content>
          </Card>
        ))}
    </Screen>
  );
}
