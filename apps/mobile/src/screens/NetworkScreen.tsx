import { NetworkOwnershipSection } from "./NetworkOwnershipSection";
import { OpenTokensSection } from "./OpenTokensSection";
import { nativeAttachments } from "../platform/attachments";
import { newEntityId } from "../platform/runtime";
import { useState } from "react";
import { Button, Checkbox, Text, TextInput } from "react-native-paper";
import {
  useNetworkManagement,
  prepareAttachmentConversion,
  type LedgerController,
} from "@hamster-ledger/ledger-react";
import type { BookRole } from "@hamster-ledger/core";
import { useNativeAccount } from "../auth/NativeAccount";
import { nativeStore } from "../platform/storage";
import { Screen, Section, ErrorMessage } from "../ui/Screen";
import { ChoiceField } from "../ui/ChoiceField";
const ROLES = [
  { value: "viewer", label: "只读" },
  { value: "member", label: "成员" },
  { value: "admin", label: "管理员" },
];
export function NetworkScreen({
  controller,
}: {
  controller: LedgerController;
}): React.JSX.Element {
  const account = useNativeAccount();
  const [hasConfirmed, setConfirmed] = useState(false),
    [code, setCode] = useState(""),
    [role, setRole] = useState<BookRole>("member");
  const manager = useNetworkManagement({
    controller,
    client: account.client,
    userId: account.credentials?.user.id ?? null,
    server: account.server,
    prepareConversion: async (mode) => {
      const backupKey = "hamster-ledger.v1.network-backup." + mode;
      if ((await nativeStore.getItem(backupKey)) === null)
        await nativeStore.setItem(backupKey, JSON.stringify(controller.ledger));
      const raw = await nativeStore.getItem(
        "hamster.native.sync." +
          account.server +
          ":" +
          account.credentials?.user.id +
          ":" +
          mode,
      );
      const link: { id: string; revision: number } | null = raw
        ? JSON.parse(raw)
        : null;
      const attachmentMap = await prepareAttachmentConversion({
        store: nativeAttachments,
        mode,
        ledger: controller.ledger,
        client: account.client,
        newId: newEntityId,
      });
      return {
        ...(link ? { sourceBookId: link.id, revision: link.revision } : {}),
        attachmentMap,
      };
    },
  });
  const cloud = controller.books.find(
    (item) => item.id === controller.mode,
  )?.cloud;
  const currentRole = controller.network?.role,
    canManage = currentRole === "owner" || currentRole === "admin";
  return (
    <Screen>
      <Text variant="headlineSmall">家庭与联网账本</Text>
      <ErrorMessage message={manager.error} />
      {manager.message ? (
        <Text accessibilityLiveRegion="polite">{manager.message}</Text>
      ) : null}
      {!account.credentials ? (
        <Text>请先到账号页面登录。</Text>
      ) : (
        <>
          {!controller.network?.isConnected ? (
            <Section title="启用联网账本">
              <Text>转换前保留备份。联网账本在线编辑，断网可查看缓存。</Text>
              <Checkbox.Item
                label="我已了解并确认转换"
                status={hasConfirmed ? "checked" : "unchecked"}
                onPress={() => setConfirmed(!hasConfirmed)}
              />
              <Button
                mode="contained"
                disabled={
                  !hasConfirmed || manager.isBusy || controller.mode === "demo"
                }
                onPress={() => void manager.run(manager.convert)}
              >
                转换当前账本
              </Button>
            </Section>
          ) : (
            <Section
              title={controller.network.isOnline ? "已连接" : "离线只读"}
            >
              <Text>
                当前角色：
                {currentRole === "owner"
                  ? "所有者"
                  : ROLES.find((item) => item.value === currentRole)?.label}
              </Text>
              <Button
                onPress={() =>
                  void manager.run(async () => {
                    await controller.network?.refresh();
                  })
                }
              >
                刷新账本
              </Button>
            </Section>
          )}
          <Section title="加入账本">
            <TextInput label="邀请码" value={code} onChangeText={setCode} />
            <Button
              disabled={!code || manager.isBusy}
              onPress={() => void manager.run(() => manager.join(code.trim()))}
            >
              加入
            </Button>
            {manager.books.map((book) => (
              <Button
                key={book.id}
                mode="outlined"
                onPress={() => void manager.run(() => manager.open(book))}
              >
                {book.name}
              </Button>
            ))}
          </Section>
          {canManage ? (
            <Section title="邀请家人">
              <ChoiceField
                label="邀请角色"
                value={role}
                options={ROLES.filter(
                  (item) => currentRole === "owner" || item.value !== "admin",
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
                onPress={() => void manager.run(() => manager.invite(role))}
              >
                生成邀请码
              </Button>
              {manager.inviteCode ? (
                <Text selectable>
                  邀请码：{manager.inviteCode}。7 天有效，仅可使用一次。
                </Text>
              ) : null}
              {manager.invites
                .filter((invite) => !invite.usedBy && !invite.revokedAt)
                .map((invite) => (
                  <Button
                    key={invite.id}
                    onPress={() =>
                      void manager.run(() =>
                        manager.manage(`/invites/${invite.id}`, "DELETE", {}),
                      )
                    }
                  >
                    撤销 {new Date(invite.expiresAt).toLocaleDateString()}{" "}
                    到期的邀请
                  </Button>
                ))}
            </Section>
          ) : null}
          {manager.members.length ? (
            <Section title="账本成员">
              {manager.members.map((member) => (
                <Section key={member.id} title={member.username}>
                  <Text>
                    {member.role === "owner"
                      ? "所有者"
                      : ROLES.find((item) => item.value === member.role)?.label}
                  </Text>
                  {canManage &&
                  member.role !== "owner" &&
                  (currentRole === "owner" || member.role !== "admin") ? (
                    <>
                      <ChoiceField
                        label="成员角色"
                        value={member.role}
                        options={ROLES.filter(
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
                        onPress={() =>
                          void manager.run(() =>
                            manager.manage(
                              `/members/${member.id}`,
                              "DELETE",
                              {},
                            ),
                          )
                        }
                      >
                        移除成员
                      </Button>
                    </>
                  ) : null}
                </Section>
              ))}
            </Section>
          ) : null}
          {controller.network?.isConnected ? (
            <NetworkOwnershipSection
              key={controller.mode}
              manager={manager}
              currentRole={currentRole}
              userId={account.credentials.user.id}
            />
          ) : null}
          {cloud && controller.network?.isConnected ? (
            <OpenTokensSection
              key={`${cloud.id}:${account.server}:${account.credentials?.user.id}`}
              client={account.client}
              bookId={cloud.id}
              isViewer={currentRole === "viewer"}
            />
          ) : null}
          {manager.history.length ? (
            <Section title="操作历史">
              {manager.history.map((item) => (
                <Text key={item.id}>
                  {new Date(item.createdAt).toLocaleString()} · {item.username}{" "}
                  · {item.source} · {item.summary}
                </Text>
              ))}
            </Section>
          ) : null}
        </>
      )}
    </Screen>
  );
}
