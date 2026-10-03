import { NetworkOwnership } from "./NetworkOwnership";
import { useState } from "react";
import {
  Alert,
  Button,
  Checkbox,
  Group,
  Select,
  Stack,
  Text,
  TextInput,
} from "@mantine/core";
import {
  useNetworkManagement,
  type LedgerController,
} from "@hamster-ledger/ledger-react";
import type { BookRole } from "@hamster-ledger/core";
import { useAuth } from "../../auth/auth-context";
import { useNetworkClient } from "../../hooks/useNetworkController";
import { protectedStore } from "../../platform/browser/vault";
import { linkKey, type Link } from "../../platform/browser/sync-link";
const ROLES = [
  { value: "viewer", label: "只读" },
  { value: "member", label: "成员" },
  { value: "admin", label: "管理员" },
];
export function NetworkPanel({
  controller,
}: {
  controller: LedgerController;
}): React.JSX.Element {
  const auth = useAuth(),
    client = useNetworkClient();
  const [hasConfirmed, setConfirmed] = useState(false),
    [code, setCode] = useState(""),
    [role, setRole] = useState<BookRole>("member");
  const manager = useNetworkManagement({
    controller,
    client,
    userId: auth.user?.id ?? null,
    server: location.origin,
    prepareConversion: async (mode) => {
      const backupKey = "hamster-ledger.v1.network-backup." + mode;
      if ((await protectedStore.getItem(backupKey)) === null)
        await protectedStore.setItem(
          backupKey,
          JSON.stringify(controller.ledger),
        );
      const raw = await protectedStore.getItem(
        linkKey(auth.user?.id ?? "", mode),
      );
      const link: Link | null = raw ? JSON.parse(raw) : null;
      return link ? { sourceBookId: link.id, revision: link.revision } : {};
    },
  });
  const currentRole = controller.network?.role;
  const canManage = currentRole === "owner" || currentRole === "admin";
  return (
    <section className="panel" style={{ gridColumn: "1 / -1" }}>
      <Stack gap="md">
        <div>
          <h2>家庭与联网账本</h2>
          <p className="muted">
            共享记账、邀请家人，或开启服务端自动记账。联网账本断网时可查看已缓存内容。
          </p>
        </div>
        {manager.error ? (
          <Alert color="red" role="alert">
            {manager.error}
          </Alert>
        ) : null}
        {manager.message ? <Text role="status">{manager.message}</Text> : null}
        {!auth.user ? (
          <Text>请先登录自托管账号，再创建或加入联网账本。</Text>
        ) : (
          <>
            {!controller.network?.isConnected ? (
              <>
                <Checkbox
                  label="我已了解：当前账本将改为在线编辑，转换前会保留备份"
                  checked={hasConfirmed}
                  onChange={(event) =>
                    setConfirmed(event.currentTarget.checked)
                  }
                />
                <Button
                  disabled={
                    !hasConfirmed ||
                    manager.isBusy ||
                    controller.mode === "demo"
                  }
                  onClick={() => void manager.run(manager.convert)}
                >
                  将当前账本设为联网账本
                </Button>
              </>
            ) : (
              <Group>
                <Text>
                  {controller.network.isOnline ? "已连接" : "离线只读"} ·
                  当前角色：
                  {currentRole === "owner"
                    ? "所有者"
                    : ROLES.find((item) => item.value === currentRole)?.label}
                </Text>
                <Button
                  variant="outline"
                  onClick={() =>
                    void manager.run(async () => {
                      await controller.network?.refresh();
                    })
                  }
                >
                  刷新账本
                </Button>
              </Group>
            )}
            <Group align="end">
              <TextInput
                label="邀请码"
                value={code}
                onChange={(event) => setCode(event.currentTarget.value)}
              />
              <Button
                disabled={!code || manager.isBusy}
                onClick={() =>
                  void manager.run(() => manager.join(code.trim()))
                }
              >
                加入账本
              </Button>
            </Group>
            {manager.books.map((book) => (
              <Group key={book.id} justify="space-between">
                <Text>{book.name}</Text>
                <Button
                  variant="subtle"
                  disabled={manager.isBusy}
                  onClick={() => void manager.run(() => manager.open(book))}
                >
                  打开账本
                </Button>
              </Group>
            ))}
            {canManage ? (
              <>
                <Group align="end">
                  <Select
                    label="邀请角色"
                    value={role}
                    data={ROLES.filter(
                      (item) =>
                        currentRole === "owner" || item.value !== "admin",
                    )}
                    onChange={(value) =>
                      setRole(
                        value === "admin"
                          ? "admin"
                          : value === "viewer"
                            ? "viewer"
                            : "member",
                      )
                    }
                  />
                  <Button
                    disabled={manager.isBusy}
                    onClick={() => void manager.run(() => manager.invite(role))}
                  >
                    生成邀请码
                  </Button>
                </Group>
                {manager.inviteCode ? (
                  <Alert title="邀请码仅显示此次">
                    {manager.inviteCode}
                    <Text size="sm">7 天有效，仅可使用一次。</Text>
                  </Alert>
                ) : null}
                {manager.invites
                  .filter((invite) => !invite.usedBy && !invite.revokedAt)
                  .map((invite) => (
                    <Group key={invite.id}>
                      <Text size="sm">
                        {new Date(invite.expiresAt).toLocaleDateString()} 到期 ·{" "}
                        {
                          ROLES.find((item) => item.value === invite.role)
                            ?.label
                        }
                      </Text>
                      <Button
                        variant="subtle"
                        onClick={() =>
                          void manager.run(() =>
                            manager.manage(
                              `/invites/${invite.id}`,
                              "DELETE",
                              {},
                            ),
                          )
                        }
                      >
                        撤销邀请
                      </Button>
                    </Group>
                  ))}
              </>
            ) : null}
            {manager.members.map((member) => (
              <Group key={member.id} justify="space-between">
                <Text>
                  {member.username} ·{" "}
                  {member.role === "owner"
                    ? "所有者"
                    : ROLES.find((item) => item.value === member.role)?.label}
                </Text>
                {canManage &&
                member.role !== "owner" &&
                (currentRole === "owner" || member.role !== "admin") ? (
                  <Group>
                    <Select
                      aria-label={`修改 ${member.username} 的角色`}
                      value={member.role}
                      data={ROLES.filter(
                        (item) =>
                          currentRole === "owner" || item.value !== "admin",
                      )}
                      onChange={(value) =>
                        void manager.run(() =>
                          manager.manage(`/members/${member.id}`, "PUT", {
                            role: value,
                          }),
                        )
                      }
                    />
                    <Button
                      color="red"
                      variant="subtle"
                      onClick={() =>
                        void manager.run(() =>
                          manager.manage(`/members/${member.id}`, "DELETE", {}),
                        )
                      }
                    >
                      移除成员
                    </Button>
                  </Group>
                ) : null}
              </Group>
            ))}
            {controller.network?.isConnected ? (
              <NetworkOwnership
                key={controller.mode}
                manager={manager}
                currentRole={currentRole}
                userId={auth.user.id}
              />
            ) : null}
            {manager.history.length ? (
              <details>
                <summary>操作历史</summary>
                {manager.history.map((item) => (
                  <p key={item.id}>
                    {new Date(item.createdAt).toLocaleString()} ·{" "}
                    {item.username} · {item.summary}
                  </p>
                ))}
              </details>
            ) : null}
          </>
        )}
      </Stack>
    </section>
  );
}
