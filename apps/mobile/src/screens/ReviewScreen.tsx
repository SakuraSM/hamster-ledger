import { Card, Button, Text } from "react-native-paper";
import { useCallback, useMemo } from "react";
import type { LedgerController } from "@hamster-ledger/ledger-react";
import {
  signedMoney,
  pendingReviewCount,
  type BillRecord,
  type Review,
} from "@hamster-ledger/core";
import { PendingReviewCard } from "./PendingReviewCard";
import { styles } from "../ui/Screen";
import { FlatList, View, type ListRenderItemInfo } from "react-native";
import { useSystemFontScale } from "../hooks/useSystemFontScale";
interface ReviewScreenProps {
  controller: LedgerController;
  onRecord: (record: BillRecord) => void;
}
export function ReviewScreen({
  controller,
  onRecord,
}: ReviewScreenProps): React.JSX.Element {
  const fontScale = useSystemFontScale();
  const pending = useMemo(
    () =>
      controller.ledger.reviews.filter((review) => review.state === "pending"),
    [controller.ledger.reviews],
  );
  const byId = useMemo(
    () =>
      new Map(controller.ledger.records.map((record) => [record.id, record])),
    [controller.ledger.records],
  );
  const { decide, isSaving } = controller;
  const renderReview = useCallback(
    ({ item: review }: ListRenderItemInfo<Review>) => {
      const records = [review.leftId, review.rightId]
        .map((id) => byId.get(id))
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
                disabled={isSaving}
                onPress={() => decide(review, "linked")}
              >
                合并为一笔
              </Button>
              <Button
                mode="outlined"
                disabled={isSaving}
                onPress={() => decide(review, "separate")}
              >
                保留两笔
              </Button>
            </View>
          </Card.Content>
        </Card>
      );
    },
    [byId, onRecord, decide, isSaving],
  );
  return (
    <FlatList
      key={fontScale}
      data={pending}
      keyExtractor={(review) => review.id}
      renderItem={renderReview}
      contentContainerStyle={styles.content}
      ListHeaderComponent={
        <View style={{ gap: 16 }}>
          <Text variant="headlineSmall" accessibilityRole="header">
            重复核对
          </Text>
          <Text>跨平台流水仅在你确认后合并统计，原始记录会保留。</Text>
          {!pendingReviewCount(controller.ledger) ? (
            <Text>当前没有待核对的记录。</Text>
          ) : null}
          <PendingReviewCard controller={controller} onRecord={onRecord} />
        </View>
      }
    />
  );
}
