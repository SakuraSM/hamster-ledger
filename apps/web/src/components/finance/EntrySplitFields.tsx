import { Button, Group, TextInput } from "@mantine/core";
import type {
  AdvancedEntryController,
  SplitMember,
} from "@hamster-ledger/ledger-react";
import { Choice } from "../../ui/Choice";
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
    <fieldset className="panel">
      <legend>AA 分摊</legend>
      <Choice
        label="分摊方式"
        value={draft.splitMode}
        onChange={(value) =>
          change("splitMode", value as typeof draft.splitMode)
        }
      >
        <option value="none">不分摊</option>
        <option value="equal">均分</option>
        <option value="weighted">按比例</option>
        <option value="fixed">指定人民币金额</option>
      </Choice>
      {draft.splitMode !== "none" ? (
        <>
          {draft.splits.map((split, index) => (
            <Group key={index} align="end">
              {members.length ? (
                <Choice
                  label={`分摊成员 ${index + 1}`}
                  value={split.memberId}
                  onChange={(value) =>
                    change(
                      "splits",
                      draft.splits.map((item, i) =>
                        i === index ? { ...item, memberId: value } : item,
                      ),
                    )
                  }
                >
                  <option value="">请选择</option>
                  {members.map((member) => (
                    <option value={member.id} key={member.id}>
                      {member.username}
                    </option>
                  ))}
                </Choice>
              ) : (
                <TextInput
                  label={`成员名称 ${index + 1}`}
                  value={split.memberId}
                  onChange={(event) =>
                    change(
                      "splits",
                      draft.splits.map((item, i) =>
                        i === index
                          ? { ...item, memberId: event.currentTarget.value }
                          : item,
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
                  inputMode="decimal"
                  value={split.value}
                  onChange={(event) =>
                    change(
                      "splits",
                      draft.splits.map((item, i) =>
                        i === index
                          ? { ...item, value: event.currentTarget.value }
                          : item,
                      ),
                    )
                  }
                />
              ) : null}
              <Button
                variant="subtle"
                onClick={() =>
                  change(
                    "splits",
                    draft.splits.filter((_, i) => i !== index),
                  )
                }
              >
                移除此分摊
              </Button>
            </Group>
          ))}
          <Button
            variant="outline"
            onClick={() =>
              change("splits", [...draft.splits, { memberId: "", value: "1" }])
            }
          >
            添加分摊成员
          </Button>
          <p className="muted">
            承担金额合计必须等于本笔折算人民币金额。均分与比例分摊的分币尾差按成员顺序分配。
          </p>
        </>
      ) : null}
    </fieldset>
  );
}
