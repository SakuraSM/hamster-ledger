import { useState } from "react";
import { Alert } from "react-native";
import { Button, Card, Text, List } from "react-native-paper";
import {
  archiveAssetAccount,
  summarizeAssets,
  money,
  type AssetAccount,
  type BillRecord,
} from "@hamster-ledger/core";
import type { LedgerController } from "@hamster-ledger/ledger-react";
import { Screen, Section, ErrorMessage } from "../ui/Screen";
import { FormSheet } from "../ui/FormSheet";
import { AccountEditor } from "./AccountEditor";
import { RecordRow } from "./RecordRow";
import { localNow } from "../platform/runtime";
interface AssetsScreenProps {
  controller: LedgerController;
  onRecord: (record: BillRecord) => void;
}
export function AssetsScreen({
  controller,
  onRecord,
}: AssetsScreenProps): React.JSX.Element {
  const [editor, setEditor] = useState<AssetAccount | "new" | null>(null);
  const [selected, setSelected] = useState<string | null>(null);
  const [error, setError] = useState("");
  const totals = summarizeAssets({
    ledger: controller.ledger,
    through: localNow(),
  });
  const account = controller.ledger.accounts.find(
    (item) => item.id === selected,
  );
  const projection = totals.balances.find(
    (item) => item.account.id === selected,
  );
  async function archive(item: AssetAccount): Promise<void> {
    try {
      await controller.commit(
        archiveAssetAccount({
          ledger: controller.ledger,
          accountId: item.id,
          isArchived: !item.isArchived,
        }),
      );
      setSelected(null);
    } catch (cause) {
      setError(cause instanceof Error ? cause.message : "归档失败");
    }
  }
  return (
    <>
      <Screen>
        <Text variant="headlineSmall" accessibilityRole="header">
          资产管理
        </Text>
        <Card mode="contained">
          <Card.Content>
            <Text>净资产</Text>
            <Text variant="displaySmall">¥{money(totals.netAssets)}</Text>
            <Text>
              总资产 ¥{money(totals.assets)} · 总负债 ¥
              {money(totals.liabilities)}
            </Text>
          </Card.Content>
        </Card>
        <Button icon="plus" mode="contained" onPress={() => setEditor("new")}>
          添加账户
        </Button>
        <ErrorMessage message={error} />
        <Section title="账户">
          {controller.ledger.accounts.length ? (
            controller.ledger.accounts.map((item) => (
              <List.Item
                key={item.id}
                title={item.name}
                description={`${item.type}${item.isArchived ? " · 已归档" : ""}`}
                onPress={() => setSelected(item.id)}
                left={(props) => (
                  <List.Icon
                    {...props}
                    icon={
                      item.kind === "asset"
                        ? "wallet-outline"
                        : "credit-card-outline"
                    }
                  />
                )}
                right={() => (
                  <Text style={{ alignSelf: "center" }}>
                    ¥
                    {money(
                      totals.balances.find(
                        (value) => value.account.id === item.id,
                      )?.balance ?? item.openingBalance,
                    )}
                  </Text>
                )}
              />
            ))
          ) : (
            <Text>添加账户并确认余额，再关联收支流水。</Text>
          )}
        </Section>
      </Screen>
      {account ? (
        <FormSheet title={account.name} onClose={() => setSelected(null)}>
          <Text variant="headlineMedium">
            ¥{money(projection?.balance ?? account.openingBalance)}
          </Text>
          <Text>
            基准余额 ¥{money(account.openingBalance)} · {account.balanceAt}
          </Text>
          <Text>别名：{account.aliases.join("、") || "无"}</Text>
          <Button
            mode="contained"
            onPress={() => {
              setSelected(null);
              setEditor(account);
            }}
          >
            编辑 / 校准余额
          </Button>
          <Button
            disabled={controller.isSaving}
            onPress={() =>
              Alert.alert(
                account.isArchived ? "恢复账户" : "归档账户",
                "历史流水与账户关联会保留。",
                [
                  { text: "取消", style: "cancel" },
                  { text: "确认", onPress: () => void archive(account) },
                ],
              )
            }
          >
            {account.isArchived ? "恢复账户" : "归档账户"}
          </Button>
          <Section title="关联流水">
            {controller.ledger.records
              .filter(
                (record) =>
                  !record.isDeleted &&
                  (record.accountId === account.id ||
                    record.transferToAccountId === account.id),
              )
              .slice()
              .sort((left, right) => right.date.localeCompare(left.date))
              .map((record) => (
                <RecordRow
                  key={record.id}
                  record={record}
                  onPress={(item) => {
                    setSelected(null);
                    onRecord(item);
                  }}
                />
              ))}
          </Section>
          <Section title="余额校准记录">
            {account.checkpoints.map((checkpoint) => (
              <Text key={checkpoint.id}>
                {checkpoint.at} · ¥{money(checkpoint.balance)} ·{" "}
                {checkpoint.note}
              </Text>
            ))}
          </Section>
        </FormSheet>
      ) : null}
      {editor ? (
        <AccountEditor
          account={editor === "new" ? undefined : editor}
          controller={controller}
          onClose={() => setEditor(null)}
        />
      ) : null}
    </>
  );
}
