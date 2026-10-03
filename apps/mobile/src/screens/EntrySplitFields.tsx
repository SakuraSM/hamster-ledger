import { Button, Text, TextInput } from "react-native-paper";
import type {
  AdvancedEntryController,
  SplitMember,
} from "@hamster-ledger/ledger-react";
import { ChoiceField } from "../ui/ChoiceField";
import { Section } from "../ui/Screen";
export function EntrySplitFields({
  form,
  members,
}: {
  form: AdvancedEntryController;
  members: SplitMember[];
}): React.JSX.Element | null {
  const { draft, change } = form;
  if (draft.type !== "expense") return null;
  return (
    <Section title="AA 分摊">
      <ChoiceField
        label="分摊方式"
        value={draft.splitMode}
        options={[
          { value: "none", label: "不分摊" },
          { value: "equal", label: "均分" },
          { value: "weighted", label: "按比例" },
          { value: "fixed", label: "指定人民币金额" },
        ]}
        onChange={(value) =>
          change("splitMode", value as typeof draft.splitMode)
        }
      />
      {draft.splitMode !== "none" ? (
        <>
          {draft.splits.map((split, index) => (
            <Section key={index} title={`成员 ${index + 1}`}>
              {members.length ? (
                <ChoiceField
                  label="分摊成员"
                  value={split.memberId}
                  options={[
                    { value: "", label: "请选择" },
                    ...members.map((item) => ({
                      value: item.id,
                      label: item.username,
                    })),
                  ]}
                  onChange={(value) =>
                    change(
                      "splits",
                      draft.splits.map((item, i) =>
                        i === index ? { ...item, memberId: value } : item,
                      ),
                    )
                  }
                />
              ) : (
                <TextInput
                  label="成员名称"
                  value={split.memberId}
                  onChangeText={(value) =>
                    change(
                      "splits",
                      draft.splits.map((item, i) =>
                        i === index ? { ...item, memberId: value } : item,
                      ),
                    )
                  }
                />
              )}
              {draft.splitMode !== "equal" ? (
                <TextInput
                  label={
                    draft.splitMode === "weighted"
                      ? "比例（正整数）"
                      : "承担金额（人民币元）"
                  }
                  value={split.value}
                  keyboardType="decimal-pad"
                  onChangeText={(value) =>
                    change(
                      "splits",
                      draft.splits.map((item, i) =>
                        i === index ? { ...item, value } : item,
                      ),
                    )
                  }
                />
              ) : null}
              <Button
                onPress={() =>
                  change(
                    "splits",
                    draft.splits.filter((_, i) => i !== index),
                  )
                }
              >
                移除此分摊
              </Button>
            </Section>
          ))}
          <Button
            onPress={() =>
              change("splits", [...draft.splits, { memberId: "", value: "1" }])
            }
          >
            添加分摊成员
          </Button>
          <Text>分摊合计须等于折算人民币金额。分币尾差按成员顺序分配。</Text>
        </>
      ) : null}
    </Section>
  );
}
