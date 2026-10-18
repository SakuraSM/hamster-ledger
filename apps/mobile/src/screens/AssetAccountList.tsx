import { useState } from "react";
import { List, Text, TextInput, Checkbox } from "react-native-paper";
import {
  projectAccountBalance,
  formatCurrency,
  type Ledger,
} from "@hamster-ledger/core";
import { Section } from "../ui/Screen";
interface AssetAccountListProps {
  ledger: Ledger;
  through: string;
  changes: Record<string, number | null>;
  onSelect: (id: string) => void;
}
export function AssetAccountList({
  ledger,
  through,
  changes,
  onSelect,
}: AssetAccountListProps): React.JSX.Element {
  const [search, setSearch] = useState("");
  const [showArchived, setShowArchived] = useState(false);
  const accounts = ledger.accounts.filter(
    (account) =>
      (showArchived || !account.isArchived) &&
      [account.name, account.type, ...account.aliases].some((value) =>
        value.toLowerCase().includes(search.trim().toLowerCase()),
      ),
  );
  return (
    <>
      <TextInput
        mode="outlined"
        label="查找账户"
        value={search}
        onChangeText={setSearch}
      />
      {(["asset", "liability"] as const).map((kind) => (
        <Section key={kind} title={kind === "asset" ? "资产账户" : "负债账户"}>
          {accounts
            .filter((account) => account.kind === kind)
            .map((account) => {
              const projection = projectAccountBalance({
                ledger,
                account,
                through,
              });
              const change = changes[account.id];
              const amount = (minor: number): string =>
                formatCurrency({ minor, currency: account.currency ?? "CNY" });
              return (
                <List.Item
                  key={account.id}
                  title={account.name}
                  titleNumberOfLines={2}
                  description={`${account.type}${account.isArchived ? " · 已归档" : ""}\n${projection.baseline ? (account.kind === "liability" && projection.balance < 0 ? `预存 ${amount(Math.abs(projection.balance))}` : amount(projection.balance)) : "尚无余额基准"} · ${change == null ? "暂无月初基准" : `本月 ${change >= 0 ? "+" : ""}${amount(change)}`}`}
                  descriptionNumberOfLines={3}
                  onPress={() => onSelect(account.id)}
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
                  right={(props) => (
                    <List.Icon {...props} icon="chevron-right" />
                  )}
                />
              );
            })}
          {!accounts.some((account) => account.kind === kind) ? (
            <Text>
              {search
                ? "没有匹配的账户。"
                : "暂无账户，可添加银行卡、现金、信用卡或贷款。"}
            </Text>
          ) : null}
        </Section>
      ))}
      <Checkbox.Item
        label="显示已归档账户"
        status={showArchived ? "checked" : "unchecked"}
        onPress={() => setShowArchived(!showArchived)}
      />
    </>
  );
}
