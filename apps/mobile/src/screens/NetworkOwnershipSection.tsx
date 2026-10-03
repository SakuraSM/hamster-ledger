import { useState } from "react";
import { Button, Checkbox } from "react-native-paper";
import type { BookRole } from "@hamster-ledger/core";
import type { NetworkManagement } from "@hamster-ledger/ledger-react";
import { Section } from "../ui/Screen";
import { ChoiceField } from "../ui/ChoiceField";
export function NetworkOwnershipSection({
  manager,
  currentRole,
  userId,
}: {
  manager: NetworkManagement;
  currentRole?: BookRole;
  userId: string;
}): React.JSX.Element {
  const [transferUser, setTransferUser] = useState(""),
    [hasConfirmedExit, setConfirmedExit] = useState(false);
  return (
    <Section title="账本归属">
      {currentRole === "owner" ? (
        <>
          <ChoiceField
            label="转移所有权给"
            value={transferUser}
            options={manager.members
              .filter((member) => member.id !== userId)
              .map((member) => ({
                value: member.id,
                label: member.username,
              }))}
            onChange={setTransferUser}
          />
          <Button
            disabled={!transferUser || manager.isBusy}
            onPress={() =>
              void manager.run(() =>
                manager.manage("/owner", "PUT", {
                  userId: transferUser,
                }),
              )
            }
          >
            确认转移所有权
          </Button>
        </>
      ) : null}
      <Checkbox.Item
        label={
          currentRole === "owner"
            ? "我确认删除联网账本及服务端数据"
            : "我确认退出此账本"
        }
        status={hasConfirmedExit ? "checked" : "unchecked"}
        onPress={() => setConfirmedExit(!hasConfirmedExit)}
      />
      <Button
        disabled={!hasConfirmedExit || manager.isBusy}
        onPress={() =>
          void manager.run(() => manager.exitBook(currentRole === "owner"))
        }
      >
        {currentRole === "owner" ? "删除联网账本" : "退出联网账本"}
      </Button>
    </Section>
  );
}
