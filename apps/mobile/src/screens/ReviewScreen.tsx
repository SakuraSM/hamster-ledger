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
import { ReceiptAction } from "./ReceiptAction";
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
  const isAmountHidden = Boolean(controller.ledger.preferences?.hideAmounts);
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
            <Text>
              {isAmountHidden
                ? "金额已隐藏，请核对来源和日期。"
                : review.reasons.join(" · ")}
            </Text>
            <View style={{ flexDirection: "row", flexWrap: "wrap", gap: 12 }}>
              {records.map((record, index) => (
                <Card
                  key={record.id}
                  mode="contained"
                  style={{ flexGrow: 1, flexBasis: 144 }}
                >
                  <Card.Content style={{ gap: 8 }}>
                    <Text>
                      来源 {index + 1} · {record.source}
                    </Text>
                    <Text variant="headlineSmall" style={{ fontWeight: "700" }}>
                      {isAmountHidden ? "••••" : signedMoney(record)}
                    </Text>
                    <Text>
                      {isAmountHidden ? "账单金额已隐藏" : record.merchant} ·{" "}
                      {record.date}
                    </Text>
                    {!isAmountHidden ? <Text>{record.account}</Text> : null}
                    <Button
                      contentStyle={{ minHeight: 48 }}
                      onPress={() => onRecord(record)}
                    >
                      查看原始流水
                    </Button>
                  </Card.Content>
                </Card>
              ))}
            </View>
            <View style={styles.row}>
              <ReceiptAction
                disabled={isSaving}
                onPress={() => decide(review, "linked")}
              >
                合并为一笔
              </ReceiptAction>
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
    [byId, onRecord, decide, isSaving, isAmountHidden],
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
            是同一笔吗
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
