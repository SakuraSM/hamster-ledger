import { View } from "react-native";
import { ReceiptAction } from "./ReceiptAction";
import { Button, Card, Text } from "react-native-paper";
import { signedMoney, type BillRecord } from "@hamster-ledger/core";
import {
  usePendingReview,
  type LedgerController,
} from "@hamster-ledger/ledger-react";
import { ChoiceField } from "../ui/ChoiceField";
import { ErrorMessage, styles } from "../ui/Screen";

interface PendingReviewCardProps {
  controller: LedgerController;
  onRecord: (record: BillRecord) => void;
}
export function PendingReviewCard({
  controller,
  onRecord,
}: PendingReviewCardProps): React.JSX.Element | null {
  const review = usePendingReview(controller);
  const record = review.record;
  const candidate = review.candidate;
  const isAmountHidden = Boolean(controller.ledger.preferences?.hideAmounts);
  if (!record) return null;
  const index = review.records.indexOf(record);
  return (
    <Card mode="outlined">
      <Card.Content style={{ gap: 12 }}>
        <Text variant="titleLarge" accessibilityRole="header">
          待确认流水 · {review.records.length} 笔
        </Text>
        <Text>选择关联对象，或核对后确认为独立账单。</Text>
        <View style={styles.row}>
          <Text>
            第 {index + 1} / {review.records.length} 笔
          </Text>
          <Button
            disabled={review.isBusy || index === 0}
            onPress={() => review.selectRecord(review.records[index - 1].id)}
          >
            上一笔
          </Button>
          <Button
            disabled={review.isBusy || index === review.records.length - 1}
            onPress={() => review.selectRecord(review.records[index + 1].id)}
          >
            下一笔
          </Button>
        </View>
        <Text variant="titleMedium">
          {isAmountHidden
            ? "待确认账单 · 金额已隐藏"
            : `${record.merchant} · ${signedMoney(record)}`}
        </Text>
        <Text>
          {record.source} · {record.date}
        </Text>
        {!isAmountHidden ? <Text>{record.account || "未提供账户"}</Text> : null}
        {!isAmountHidden ? (
          <Text>{record.reason || "尚未计入收支。"}</Text>
        ) : null}
        <Button onPress={() => onRecord(record)}>查看待确认原始流水</Button>
        {review.candidates.length ? (
          <ChoiceField
            label="选择要关联的流水"
            value={review.candidate?.id ?? ""}
            disabled={review.isBusy}
            onChange={review.selectCandidate}
            options={[
              { value: "", label: "请核对后选择" },
              ...review.candidates.map((candidate) => ({
                value: candidate.id,
                label: isAmountHidden
                  ? `${candidate.source} · ${candidate.date} · 金额已隐藏`
                  : `${candidate.merchant} · ${candidate.source} · ${candidate.date} · ${signedMoney(candidate)}`,
              })),
            ]}
          />
        ) : (
          <Text>
            当前没有符合关联条件的已入账流水，请核对金额、类型和账户。
          </Text>
        )}
        {candidate ? (
          <Button onPress={() => onRecord(candidate)}>查看候选原始流水</Button>
        ) : null}
        <Text>
          独立账单按当前收支类型计入汇总；关联后只计一次，原始流水均保留。
        </Text>
        <ReceiptAction
          disabled={review.isBusy || !review.candidate}
          onPress={() => void review.resolve("link")}
        >
          关联所选流水
        </ReceiptAction>
        <Button
          mode="outlined"
          disabled={review.isBusy}
          onPress={() => void review.resolve("confirm")}
        >
          确认为独立账单
        </Button>
        <ErrorMessage
          message={
            isAmountHidden && review.error
              ? "核对保存失败，请重新检查。"
              : review.error
          }
        />
      </Card.Content>
    </Card>
  );
}
