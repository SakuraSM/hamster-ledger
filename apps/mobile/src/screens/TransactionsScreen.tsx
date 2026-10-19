import { SavedFilters } from "./SavedFilters";
import {
  useBatchRecords,
  useBookMembers,
  useTransactionQuery,
  type LedgerController,
} from "@hamster-ledger/ledger-react";
import { useNativeAccount } from "../auth/NativeAccount";
import { BatchActions } from "./BatchActions";
import {
  RecordFilters,
  EMPTY_FILTER,
  type FinanceFilter,
} from "./RecordFilters";
import { useCallback, useMemo, useRef, useState } from "react";
import { FlatList, View, type ListRenderItemInfo } from "react-native";
import { useSystemFontScale } from "../hooks/useSystemFontScale";
import {
  Searchbar,
  SegmentedButtons,
  Text,
  Checkbox,
  Button,
} from "react-native-paper";
import { money, type Source, type BillRecord } from "@hamster-ledger/core";
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
  const restoreOffset = useRef<number | null>(null);
  const list = useRef<FlatList<BillRecord>>(null);
  const [position, setPosition] = useState(0);
  const fontScale = useSystemFontScale();
  const ledger = controller.ledger;
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
  const [filter, setFilter] = useState<FinanceFilter>(EMPTY_FILTER);
  const [query, setQuery] = useState("");
  const [view, setView] = useState("active");
  const [source, setSource] = useState<Source | "">("");
  const queryFilter = useMemo(
    () => ({
      ...filter,
      query,
      source,
      isDeleted: view === "deleted",
      status: view === "pending" ? ("pending" as const) : filter.status,
    }),
    [filter, query, source, view],
  );
  const result = useTransactionQuery(ledger, queryFilter);
  const records = result.records;
  const batch = useBatchRecords(controller, records);
  const amount = (value: number): string =>
    ledger.preferences?.hideAmounts ? "••••" : `¥${money(value)}`;
  function clearFilters(): void {
    setFilter(EMPTY_FILTER);
    setQuery("");
    setSource("");
    setView("active");
  }
  const sources = useMemo(
    () =>
      Array.from(
        new Set(
          ledger.records.flatMap((record) => [
            record.source,
            ...record.linkedSources,
          ]),
        ),
      ),
    [ledger.records],
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
        ref={list}
        onContentSizeChange={() => {
          if (restoreOffset.current !== null) {
            list.current?.scrollToOffset({
              offset: restoreOffset.current,
              animated: false,
            });
            restoreOffset.current = null;
          }
        }}
        onScrollEndDrag={(event) =>
          setPosition(Math.round(event.nativeEvent.contentOffset.y))
        }
        onMomentumScrollEnd={(event) =>
          setPosition(Math.round(event.nativeEvent.contentOffset.y))
        }
        key={fontScale}
        ListHeaderComponent={
          <>
            <SavedFilters
              bookId={`native:${controller.mode}`}
              filter={queryFilter}
              position={position}
              onApply={({ filter: value, position: offset }) => {
                setFilter(value);
                setQuery(value.query);
                setSource(value.source);
                setView(value.isDeleted ? "deleted" : "active");
                setPosition(offset);
                restoreOffset.current = offset;
                list.current?.scrollToOffset({ offset, animated: false });
              }}
            />
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
              onValueChange={(value) => {
                setView(value);
                setFilter((previous) => ({ ...previous, status: "" }));
              }}
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
              onChange={(value) => setSource(value as Source | "")}
              options={[
                { value: "", label: "全部来源" },
                ...sources.map((value) => ({ value, label: value })),
              ]}
            />
            <Text variant="labelLarge">共 {records.length} 笔</Text>
            <Button onPress={() => setFiltersOpen(!filtersOpen)}>
              {filtersOpen ? "收起筛选" : "更多筛选"}
            </Button>
            {filtersOpen ? (
              <RecordFilters
                ledger={ledger}
                filter={{ ...filter, status: queryFilter.status }}
                isTrash={view === "deleted"}
                members={members}
                onChange={(value) => {
                  setFilter(value);
                  if (view === "pending" && value.status !== "pending")
                    setView("active");
                }}
              />
            ) : null}
            <Button onPress={clearFilters}>清除全部筛选</Button>
            {result.error ? (
              <Text accessibilityRole="alert">{result.error}</Text>
            ) : (
              <View style={{ gap: 4, marginVertical: 8 }}>
                <Text>筛选内已入账：收入 {amount(result.summary.income)}</Text>
                <Text>
                  净支出 {amount(result.summary.expense)} · 结余{" "}
                  {amount(result.summary.net)}
                </Text>
                <Text variant="bodySmall">
                  净支出已扣退款；待确认、重复、转账及不计收支的记录不计入合计。
                </Text>
              </View>
            )}
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
