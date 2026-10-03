import { useState } from "react";
import { Stack, Group, Select, Button, Checkbox } from "@mantine/core";
import type { BookRole } from "@hamster-ledger/core";
import type { NetworkManagement } from "@hamster-ledger/ledger-react";
export function NetworkOwnership({
  manager,
  currentRole,
  userId,
}: {
  manager: NetworkManagement;
  currentRole?: BookRole;
  userId: string;
}): React.JSX.Element {
  const [hasConfirmedExit, setConfirmedExit] = useState(false);
  const [transferUser, setTransferUser] = useState<string | null>(null);
  return (
    <Stack>
      {currentRole === "owner" ? (
        <Group align="end">
          <Select
            label="转移所有权给"
            value={transferUser}
            data={manager.members
              .filter((member) => member.id !== userId)
              .map((member) => ({
                value: member.id,
                label: member.username,
              }))}
            onChange={setTransferUser}
          />
          <Button
            disabled={!transferUser || manager.isBusy}
            variant="outline"
            onClick={() =>
              void manager.run(() =>
                manager.manage("/owner", "PUT", {
                  userId: transferUser,
                }),
              )
            }
          >
            确认转移所有权
          </Button>
        </Group>
      ) : null}
      <Checkbox
        label={
          currentRole === "owner"
            ? "我确认删除联网账本及其服务端数据"
            : "我确认退出此账本，之后无法访问"
        }
        checked={hasConfirmedExit}
        onChange={(event) => setConfirmedExit(event.currentTarget.checked)}
      />
      <Button
        color="red"
        variant="outline"
        disabled={!hasConfirmedExit || manager.isBusy}
        onClick={() =>
          void manager.run(() => manager.exitBook(currentRole === "owner"))
        }
      >
        {currentRole === "owner" ? "删除联网账本" : "退出联网账本"}
      </Button>
    </Stack>
  );
}
