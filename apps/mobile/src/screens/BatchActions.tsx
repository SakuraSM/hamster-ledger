import { useState } from "react";
import { Alert, View } from "react-native";
import { Button, Text } from "react-native-paper";
import { categoryDefinitions, type Ledger } from "@hamster-ledger/core";
import type { BatchController } from "@hamster-ledger/ledger-react";
import { ChoiceField } from "../ui/ChoiceField";
export function BatchActions({
  ledger,
  batch,
  onSelectAll,
}: {
  ledger: Ledger;
  batch: BatchController;
  onSelectAll: () => void;
}): React.JSX.Element {
  const [category, setCategory] = useState("");
  return (
    <View style={{ gap: 8 }}>
      <Text>已选 {batch.selected.length} 笔</Text>
      <View style={{ flexDirection: "row", flexWrap: "wrap" }}>
        <Button disabled={batch.isBusy} onPress={onSelectAll}>
          选择当前筛选结果
        </Button>
        <Button
          disabled={!batch.selected.length || batch.isBusy}
          onPress={batch.clear}
        >
          清空选择
        </Button>
      </View>
      <ChoiceField
        label="批量修改分类"
        value={category}
        onChange={setCategory}
        options={[
          { value: "", label: "选择分类" },
          ...[
            ...new Set(
              categoryDefinitions(ledger)
                .filter((item) => !item.isArchived)
                .map((item) => item.name),
            ),
          ].map((name) => ({ value: name, label: name })),
        ]}
      />
      <View style={{ flexDirection: "row" }}>
        <Button
          disabled={!category || !batch.selected.length || batch.isBusy}
          onPress={() => void batch.apply("category", category)}
        >
          应用分类
        </Button>
        <Button
          disabled={!batch.selected.length || batch.isBusy}
          onPress={() =>
            Alert.alert(
              "删除所选账单",
              `将删除 ${batch.selected.length} 笔，可通过撤销恢复。`,
              [
                { text: "取消", style: "cancel" },
                {
                  text: "确认删除",
                  style: "destructive",
                  onPress: () => void batch.apply("delete"),
                },
              ],
            )
          }
        >
          批量删除
        </Button>
      </View>
      {batch.error ? (
        <Text accessibilityRole="alert">{batch.error}</Text>
      ) : null}
    </View>
  );
}
