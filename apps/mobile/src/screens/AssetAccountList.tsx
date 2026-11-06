import { useState } from "react";
import { StyleSheet, View } from "react-native";
import { Checkbox, List, Text, TextInput, useTheme } from "react-native-paper";
import {
  accountActiveAt,
  projectAccountBalance,
  formatCurrency,
  type Ledger,
} from "@hamster-ledger/core";

interface AssetAccountListProps {
  ledger: Ledger;
  through: string;
  changes: Record<string, number | null>;
  isAmountHidden: boolean;
  onSelect: (id: string) => void;
}
export function AssetAccountList({
  ledger,
  through,
  changes,
  isAmountHidden,
  onSelect,
}: AssetAccountListProps): React.JSX.Element {
  const theme = useTheme();
  const [search, setSearch] = useState("");
  const [showArchived, setShowArchived] = useState(false);
  const accounts = ledger.accounts.filter(
    (account) =>
      (showArchived || accountActiveAt(account, through)) &&
      [account.name, account.type, ...account.aliases].some((value) =>
        value.toLowerCase().includes(search.trim().toLowerCase()),
      ),
  );
  return (
    <View style={styles.groups}>
      <TextInput
        mode="outlined"
        label="查找账户"
        accessibilityLabel="查找账户"
        value={search}
        onChangeText={setSearch}
      />
      {(["asset", "liability"] as const).map((kind) => {
        const group = accounts.filter((account) => account.kind === kind);
        return (
          <View key={kind} style={styles.group}>
            <View style={styles.groupHeader}>
              <Text
                variant="titleMedium"
                accessibilityRole="header"
                style={styles.strong}
              >
                {kind === "asset" ? "资产账户" : "负债账户"}
              </Text>
              <Text style={{ color: theme.colors.onSurfaceVariant }}>
                {group.length} 个
              </Text>
            </View>
            {group.map((account, index) => {
              const accountLabel = isAmountHidden
                ? `${kind === "asset" ? "资产账户" : "负债账户"} ${index + 1}`
                : account.name;
              const projection = projectAccountBalance({
                ledger,
                account,
                through,
              });
              const change = changes[account.id];
              const amount = (minor: number): string =>
                isAmountHidden
                  ? "••••"
                  : formatCurrency({
                      minor,
                      currency: account.currency ?? "CNY",
                    });
              const value = projection.baseline
                ? isAmountHidden
                  ? "••••"
                  : account.kind === "liability" && projection.balance < 0
                    ? `预存 ${amount(Math.abs(projection.balance))}`
                    : amount(projection.balance)
                : "尚无余额基准";
              const description = `${account.type} · ${account.currency ?? "CNY"}${account.isArchived ? " · 已归档" : ""}\n${change == null ? "暂无月初基准" : `本月 ${!isAmountHidden && change >= 0 ? "+" : ""}${amount(change)}`}`;
              return (
                <List.Item
                  key={account.id}
                  title={accountLabel}
                  titleStyle={styles.strong}
                  titleNumberOfLines={2}
                  description={description}
                  descriptionNumberOfLines={3}
                  onPress={() => onSelect(account.id)}
                  accessibilityLabel={`${accountLabel}，${description.replace("\n", "，")}，${value}`}
                  style={[
                    styles.item,
                    { borderColor: theme.colors.outlineVariant },
                  ]}
                  left={(props) => (
                    <List.Icon
                      {...props}
                      icon={
                        kind === "asset"
                          ? "wallet-outline"
                          : "credit-card-outline"
                      }
                    />
                  )}
                  right={() => (
                    <View style={styles.value}>
                      <Text variant="titleMedium" style={styles.strong}>
                        {value}
                      </Text>
                      <List.Icon icon="chevron-right" />
                    </View>
                  )}
                />
              );
            })}
            {!group.length ? (
              <Text>{search ? "没有匹配的账户。" : "暂无账户。"}</Text>
            ) : null}
          </View>
        );
      })}
      <Checkbox.Item
        label="显示已归档账户"
        status={showArchived ? "checked" : "unchecked"}
        onPress={() => setShowArchived(!showArchived)}
      />
    </View>
  );
}
const styles = StyleSheet.create({
  groups: { gap: 20 },
  group: { gap: 4 },
  groupHeader: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "center",
    gap: 8,
  },
  item: {
    borderBottomWidth: StyleSheet.hairlineWidth,
    paddingHorizontal: 0,
    minHeight: 72,
  },
  value: { flexDirection: "row", alignItems: "center", flexShrink: 1 },
  strong: { fontWeight: "700" },
});
