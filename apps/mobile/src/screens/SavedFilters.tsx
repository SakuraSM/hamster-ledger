import { useState } from "react";
import { Button, TextInput, Text, List } from "react-native-paper";
import { useSavedFilters } from "@hamster-ledger/ledger-react";
import {
  savedTransactionFilterSchema,
  UNASSIGNED_ACCOUNT_FILTER,
  type TransactionFilter,
  type SavedTransactionView,
} from "@hamster-ledger/core";
import { nativeStore } from "../platform/storage";
export function SavedFilters({
  bookId,
  filter,
  position,
  onApply,
}: {
  bookId: string;
  filter: TransactionFilter;
  position: number;
  onApply: (view: SavedTransactionView) => void;
}): React.JSX.Element {
  const [name, setName] = useState("");
  const saved = useSavedFilters({
    store: nativeStore,
    bookId,
    filter,
    position,
    onApply,
  });
  return (
    <List.Accordion
      title="常用与保存的筛选"
      left={(props) => <List.Icon {...props} icon="filter-outline" />}
    >
      <Button
        onPress={() =>
          onApply({
            filter: savedTransactionFilterSchema.parse({
              reimbursement: "pending",
            }),
            position: 0,
          })
        }
      >
        待报销
      </Button>
      <Button
        onPress={() =>
          onApply({
            filter: savedTransactionFilterSchema.parse({
              accountId: UNASSIGNED_ACCOUNT_FILTER,
            }),
            position: 0,
          })
        }
      >
        未关联账户
      </Button>
      <TextInput
        label="筛选方案名称"
        accessibilityLabel="筛选方案名称"
        value={name}
        maxLength={40}
        onChangeText={setName}
      />
      <Button
        disabled={!saved.ready || !name.trim()}
        onPress={() => void saved.save(name)}
      >
        保存当前筛选
      </Button>
      {saved.presets.map((item) => (
        <Button
          key={item.name}
          onPress={() => onApply({ filter: item.filter, position: 0 })}
          onLongPress={() => void saved.remove(item.name)}
          accessibilityHint="点击应用，长按删除筛选方案"
        >
          {item.name}
        </Button>
      ))}
      {saved.error && <Text accessibilityRole="alert">{saved.error}</Text>}
    </List.Accordion>
  );
}
