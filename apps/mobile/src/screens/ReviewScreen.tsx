import { Card, Button, Text } from "react-native-paper";
import type { LedgerController } from "@hamster-ledger/ledger-react";
import { signedMoney, type BillRecord } from "@hamster-ledger/core";
import { Screen, styles } from "../ui/Screen";
import { View } from "react-native";
interface ReviewScreenProps {
  controller: LedgerController;
  onRecord: (record: BillRecord) => void;
}
export function ReviewScreen({
  controller,
  onRecord,
}: ReviewScreenProps): React.JSX.Element {
  const pending = controller.ledger.reviews.filter(
    (review) => review.state === "pending",
  );
  return (
    <Screen>
      <Text variant="headlineSmall" accessibilityRole="header">
        重复核对
      </Text>
      <Text>跨平台流水仅在你确认后合并统计，原始记录会保留。</Text>
      {!pending.length ? <Text>当前没有待核对的记录。</Text> : null}
      {pending.map((review) => {
        const records = [review.leftId, review.rightId]
          .map((id) =>
            controller.ledger.records.find((record) => record.id === id),
          )
          .filter((record): record is BillRecord => Boolean(record));
        return (
          <Card key={review.id} mode="outlined">
            <Card.Content style={{ gap: 12 }}>
              <Text>{review.reasons.join(" · ")}</Text>
              {records.map((record) => (
                <View key={record.id}>
                  <Text variant="titleMedium">
                    {record.merchant} · {signedMoney(record)}
                  </Text>
                  <Text>
                    {record.source} · {record.date}
                  </Text>
                  <Text>{record.account}</Text>
                  <Button onPress={() => onRecord(record)}>查看原始流水</Button>
                </View>
              ))}
              <View style={styles.row}>
                <Button
                  mode="contained"
                  disabled={controller.isSaving}
                  onPress={() => controller.decide(review, "linked")}
                >
                  合并为一笔
                </Button>
                <Button
                  mode="outlined"
                  disabled={controller.isSaving}
                  onPress={() => controller.decide(review, "separate")}
                >
                  保留两笔
                </Button>
              </View>
            </Card.Content>
          </Card>
        );
      })}
    </Screen>
  );
}
