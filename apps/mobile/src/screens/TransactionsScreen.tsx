import {
  useBatchRecords,
  useBookMembers,
  type LedgerController,
} from "@hamster-ledger/ledger-react";
import { useNativeAccount } from "../auth/NativeAccount";
import { BatchActions } from "./BatchActions";
import { RecordFilters, type FinanceFilter } from "./RecordFilters";
import { useState } from "react";
import { FlatList, View } from "react-native";
import {
  Searchbar,
  SegmentedButtons,
  Text,
  Checkbox,
  Button,
} from "react-native-paper";
import { matchesFinanceFilters, type BillRecord } from "@hamster-ledger/core";
import { RecordRow } from "./RecordRow";
import { ChoiceField } from "../ui/ChoiceField";
interface TransactionsScreenProps {
  controller: LedgerController;
  onRecord: (record: BillRecord) => void;
}
export function TransactionsScreen({
  controller,
  onRecord,
}: TransactionsScreenProps): React.JSX.Element {
  const ledger = controller.ledger,
    batch = useBatchRecords(controller);
  const remoteMembers = useBookMembers(
    useNativeAccount().client,
    controller.books.find((book) => book.id === controller.mode)?.cloud?.id,
  );
  const ids = [
    ...new Set(
      ledger.records
        .flatMap((record) => [
          record.detail?.memberId,
          ...(record.detail?.splits.map((item) => item.memberId) ?? []),
        ])
        .filter((id): id is string => !!id),
    ),
  ];
  const members = ids.map((id) => ({
    id,
    username: remoteMembers.find((item) => item.id === id)?.username ?? id,
  }));
  const [filtersOpen, setFiltersOpen] = useState(false),
    [batchOpen, setBatchOpen] = useState(false);
  const [filter, setFilter] = useState<FinanceFilter>({
    accountId: "",
    memberId: "",
    reimbursement: "",
    category: "",
  });
  const [query, setQuery] = useState("");
  const [view, setView] = useState("active");
  const [source, setSource] = useState("");
  const records = ledger.records
    .filter((record) => {
      if (view === "deleted" ? !record.isDeleted : record.isDeleted)
        return false;
      if (view === "pending" && record.status !== "pending") return false;
      if (
        !matchesFinanceFilters(ledger, record, filter) ||
        (filter.category && record.category !== filter.category)
      )
        return false;
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
      <FlatList
        ListHeaderComponent={
          <>
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
            <Button onPress={() => setFiltersOpen(!filtersOpen)}>
              {filtersOpen ? "收起筛选" : "账户、成员与报销筛选"}
            </Button>
            {filtersOpen ? (
              <RecordFilters
                ledger={ledger}
                filter={filter}
                members={members}
                onChange={setFilter}
              />
            ) : null}
            <Button onPress={() => setBatchOpen(!batchOpen)}>
              {batchOpen ? "收起批量整理" : "批量整理"}
            </Button>
            {batchOpen ? (
              <BatchActions
                ledger={ledger}
                batch={batch}
                onSelectAll={() =>
                  batch.select(records.filter((item) => !item.isDeleted))
                }
              />
            ) : null}
          </>
        }
        data={records}
        keyExtractor={(record) => record.id}
        renderItem={({ item }) => (
          <View>
            {batchOpen && !item.isDeleted ? (
              <Checkbox.Item
                label={`选择 ${item.merchant}`}
                status={
                  batch.selected.includes(item.id) ? "checked" : "unchecked"
                }
                onPress={() => batch.toggle(item)}
              />
            ) : null}
            <RecordRow record={item} onPress={onRecord} />
          </View>
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
