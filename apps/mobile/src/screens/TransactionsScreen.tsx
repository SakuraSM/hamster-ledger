import { useState } from "react";
import { FlatList, View } from "react-native";
import { Searchbar, SegmentedButtons, Text } from "react-native-paper";
import type { BillRecord, Ledger } from "@hamster-ledger/core";
import { RecordRow } from "./RecordRow";
import { ChoiceField } from "../ui/ChoiceField";
interface TransactionsScreenProps {
  ledger: Ledger;
  onRecord: (record: BillRecord) => void;
}
export function TransactionsScreen({
  ledger,
  onRecord,
}: TransactionsScreenProps): React.JSX.Element {
  const [query, setQuery] = useState("");
  const [view, setView] = useState("active");
  const [source, setSource] = useState("");
  const records = ledger.records
    .filter((record) => {
      if (view === "deleted" ? !record.isDeleted : record.isDeleted)
        return false;
      if (view === "pending" && record.status !== "pending") return false;
      if (source && source !== record.source) return false;
      return [
        record.merchant,
        record.description,
        record.category,
        record.orderId,
        ...(record.tags ?? []),
      ]
        .join(" ")
        .toLowerCase()
        .includes(query.toLowerCase());
    })
    .sort((left, right) => right.date.localeCompare(left.date));
  return (
    <View style={{ flex: 1, paddingHorizontal: 16 }}>
      <Searchbar
        icon="magnify"
        clearIcon="close"
        searchAccessibilityLabel="搜索"
        clearAccessibilityLabel="清空搜索"
        placeholder="搜索商户、备注、分类、流水号"
        accessibilityLabel="搜索账单"
        value={query}
        onChangeText={setQuery}
        style={{ marginBottom: 12 }}
      />
      <SegmentedButtons
        value={view}
        onValueChange={setView}
        buttons={[
          { value: "active", label: "全部" },
          { value: "pending", label: "待确认" },
          { value: "deleted", label: "回收站" },
        ]}
        style={{ marginBottom: 12 }}
      />
      <ChoiceField
        label="账单来源"
        value={source}
        onChange={setSource}
        options={[
          { value: "", label: "全部来源" },
          ...Array.from(
            new Set(ledger.records.map((record) => record.source)),
          ).map((value) => ({ value, label: value })),
        ]}
      />
      <Text variant="labelLarge">共 {records.length} 笔</Text>
      <FlatList
        data={records}
        keyExtractor={(record) => record.id}
        renderItem={({ item }) => (
          <RecordRow record={item} onPress={onRecord} />
        )}
        contentContainerStyle={{ paddingBottom: 100 }}
        keyboardShouldPersistTaps="handled"
        ListEmptyComponent={
          <Text style={{ padding: 24 }}>没有符合条件的账单。</Text>
        }
      />
    </View>
  );
}
