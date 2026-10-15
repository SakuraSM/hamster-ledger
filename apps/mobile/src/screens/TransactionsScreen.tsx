import {
  useBatchRecords,
  useBookMembers,
  type LedgerController,
} from "@hamster-ledger/ledger-react";
import { useNativeAccount } from "../auth/NativeAccount";
import { BatchActions } from "./BatchActions";
import { RecordFilters, type FinanceFilter } from "./RecordFilters";
import { useCallback, useMemo, useState } from "react";
import { FlatList, View, type ListRenderItemInfo } from "react-native";
import { useSystemFontScale } from "../hooks/useSystemFontScale";
import {
  Searchbar,
  SegmentedButtons,
  Text,
  Checkbox,
  Button,
} from "react-native-paper";
import { createFinanceFilter, type BillRecord } from "@hamster-ledger/core";
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
  const fontScale = useSystemFontScale();
  const ledger = controller.ledger,
    batch = useBatchRecords(controller);
  const remoteMembers = useBookMembers(
    useNativeAccount().client,
    controller.books.find((book) => book.id === controller.mode)?.cloud?.id,
  );
  const ids = useMemo(
    () => [
      ...new Set(
        ledger.records
          .flatMap((record) => [
            record.detail?.memberId,
            ...(record.detail?.splits.map((item) => item.memberId) ?? []),
          ])
          .filter((id): id is string => !!id),
      ),
    ],
    [ledger.records],
  );
  const members = useMemo(
    () =>
      ids.map((id) => ({
        id,
        username: remoteMembers.find((item) => item.id === id)?.username ?? id,
      })),
    [ids, remoteMembers],
  );
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
  const matchesFinance = useMemo(
    () => createFinanceFilter(ledger, filter),
    [ledger, filter],
  );
  const searchableRecords = useMemo(
    () =>
      ledger.records
        .map((record) => ({
          record,
          text: [
            record.merchant,
            record.description,
            record.category,
            record.orderId,
            ...(record.tags ?? []),
          ]
            .join(" ")
            .toLowerCase(),
        }))
        .sort((left, right) =>
          right.record.date.localeCompare(left.record.date),
        ),
    [ledger.records],
  );
  const sources = useMemo(
    () => Array.from(new Set(ledger.records.map((record) => record.source))),
    [ledger.records],
  );
  const normalizedQuery = query.toLowerCase();
  const records = useMemo(
    () =>
      searchableRecords
        .filter(({ record, text }) => {
          if (view === "deleted" ? !record.isDeleted : record.isDeleted)
            return false;
          if (view === "pending" && record.status !== "pending") return false;
          if (
            !matchesFinance(record) ||
            (filter.category && record.category !== filter.category)
          )
            return false;
          if (source && source !== record.source) return false;
          return text.includes(normalizedQuery);
        })
        .map(({ record }) => record),
    [
      searchableRecords,
      view,
      filter.category,
      matchesFinance,
      source,
      normalizedQuery,
    ],
  );
  const selectedIds = useMemo(() => new Set(batch.selected), [batch.selected]);
  const toggleRecord = batch.toggle;
  const renderRecord = useCallback(
    ({ item }: ListRenderItemInfo<BillRecord>) => (
      <View>
        {batchOpen && !item.isDeleted ? (
          <Checkbox.Item
            label={`选择 ${item.merchant}`}
            status={selectedIds.has(item.id) ? "checked" : "unchecked"}
            onPress={() => toggleRecord(item)}
          />
        ) : null}
        <RecordRow record={item} onPress={onRecord} />
      </View>
    ),
    [batchOpen, selectedIds, toggleRecord, onRecord],
  );
  return (
    <View style={{ flex: 1, paddingHorizontal: 16 }}>
      <FlatList
        key={fontScale}
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
                ...sources.map((value) => ({ value, label: value })),
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
        renderItem={renderRecord}
        contentContainerStyle={{ paddingBottom: 100 }}
        keyboardShouldPersistTaps="handled"
        ListEmptyComponent={
          <Text style={{ padding: 24 }}>没有符合条件的账单。</Text>
        }
      />
    </View>
  );
}
