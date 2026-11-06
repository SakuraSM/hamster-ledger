import { ImageBackground, StyleSheet, View } from "react-native";
import { Button, Text, useTheme } from "react-native-paper";
import tokens from "@hamster-ledger/design-tokens/tokens.json";
import {
  pendingReviewCount,
  pendingPreviewRecord,
  resolveAssetAccount,
  signedMoney,
  TRANSACTION_LABELS,
  type Ledger,
} from "@hamster-ledger/core";
import { HIDDEN_AMOUNT } from "../constants";
import { Screen } from "../ui/Screen";
import paper from "../../assets/receipt-paper.png";
const PENDING_CONTENT_BOTTOM_PADDING = 16;

export interface PendingScreenProps {
  ledger: Ledger;
  onReview: () => void;
  onAi: () => void;
  onPayment: () => void;
  onImport: () => void;
  onLater: () => void;
}
export function PendingScreen({
  ledger,
  onReview,
  onAi,
  onPayment,
  onImport,
  onLater,
}: PendingScreenProps): React.JSX.Element {
  const theme = useTheme();
  const drafts = (ledger.aiDrafts ?? []).filter(
    (draft) => draft.state === "pending",
  );
  const reviews = pendingReviewCount(ledger);
  const draft = drafts[0];
  const record = pendingPreviewRecord(ledger);
  const isHidden = Boolean(ledger.preferences?.hideAmounts);
  const name = isHidden
    ? "待核对账单"
    : draft
      ? draft.candidate.merchant || "交易对象待确认"
      : record?.merchant || "待核对账单";
  const date = draft ? draft.candidate.date : record?.date;
  const category = draft ? draft.candidate.category : record?.category;
  const amount = isHidden
    ? HIDDEN_AMOUNT
    : draft
      ? `${draft.candidate.currency} ${draft.candidate.amount || "金额待填写"}`
      : record
        ? signedMoney(record)
        : "";
  const account = draft
    ? ledger.accounts.find((item) => item.id === draft.candidate.accountId)
        ?.name
    : record
      ? resolveAssetAccount(record, ledger.accounts)?.name
      : undefined;
  const hasPending = Boolean(draft || record || reviews);
  return (
    <View style={styles.fill}>
      <Screen bottomPadding={PENDING_CONTENT_BOTTOM_PADDING}>
        <View style={styles.heading}>
          <View>
            <Text variant="headlineMedium" accessibilityRole="header">
              待处理
            </Text>
            <Text variant="bodySmall">核对后才会入账</Text>
          </View>
          <Text variant="displaySmall" style={{ color: theme.colors.primary }}>
            {String(drafts.length + reviews).padStart(2, "0")}
          </Text>
        </View>
        <View style={styles.filters}>
          <Button mode="contained-tonal" onPress={onAi}>
            AI 草稿 {drafts.length}
          </Button>
          <Button mode="outlined" onPress={onReview}>
            账单核对 {reviews}
          </Button>
          <Button onPress={onPayment}>支付通知</Button>
        </View>
        {hasPending ? (
          <ImageBackground
            source={theme.dark ? undefined : paper}
            resizeMode="stretch"
            style={[
              styles.paper,
              theme.dark && { backgroundColor: theme.colors.surfaceVariant },
            ]}
          >
            <Text variant="bodySmall">
              {draft
                ? `AI 草稿 · ${TRANSACTION_LABELS[draft.candidate.type]}`
                : "账单核对"}{" "}
              · 未入账
            </Text>
            <Text variant="headlineSmall" accessibilityRole="header">
              {name}
            </Text>
            {amount ? (
              <Text variant="displaySmall" style={styles.amount}>
                {amount}
              </Text>
            ) : (
              <Text>存在待核对的账单</Text>
            )}
            {!isHidden && date ? <Text>{date}</Text> : null}
            <View style={styles.note}>
              <Text>核对金额、分类和账户后，再确认入账。</Text>
            </View>
            {!isHidden && (draft || record) ? (
              <>
                <Text>
                  分类：
                  {category || "待选择"}
                </Text>
                <Text>账户：{account || "待选择"}</Text>
              </>
            ) : null}
          </ImageBackground>
        ) : (
          <View style={styles.empty}>
            <Text variant="titleLarge">暂无账单和草稿待核对</Text>
            <Text>导入账单或添加凭证后，可以在这里查看。</Text>
          </View>
        )}
        <Text variant="bodySmall">
          支付通知在本机收件箱核对，未读取时不计入上方数量。
        </Text>
      </Screen>
      <View
        style={[styles.actions, { backgroundColor: theme.colors.background }]}
      >
        <Button
          mode="contained"
          contentStyle={styles.primaryTouch}
          buttonColor={tokens.color.action}
          textColor={tokens.color.actionText}
          onPress={hasPending ? (draft ? onAi : onReview) : onImport}
        >
          {hasPending ? (draft ? "核对并入账" : "核对这笔账单") : "导入账单"}
        </Button>
        {hasPending ? <Button onPress={onLater}>稍后处理</Button> : null}
      </View>
    </View>
  );
}
const styles = StyleSheet.create({
  fill: { flex: 1 },
  actions: { paddingHorizontal: 20, paddingBottom: 8 },
  primaryTouch: { minHeight: 48 },
  heading: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "flex-start",
    gap: 12,
  },
  filters: { flexDirection: "row", flexWrap: "wrap", gap: 8 },
  paper: {
    minHeight: 340,
    paddingHorizontal: 26,
    paddingTop: 26,
    paddingBottom: 42,
    gap: 12,
    borderRadius: 10,
  },
  amount: { fontVariant: ["tabular-nums"] },
  note: { marginTop: 12, padding: 14, borderRadius: 8 },
  empty: {
    minHeight: 240,
    alignItems: "center",
    justifyContent: "center",
    gap: 12,
  },
});
