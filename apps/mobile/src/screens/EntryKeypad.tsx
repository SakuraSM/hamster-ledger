import { useState } from "react";
import { View } from "react-native";
import { Button, Text } from "react-native-paper";
import { money, parseMinor, addMinor } from "@hamster-ledger/core";
import { FormSheet } from "../ui/FormSheet";
export function EntryKeypad({
  initial,
  category,
  onApply,
  onClose,
}: {
  initial: string;
  category: string;
  onApply: (v: string) => void;
  onClose: () => void;
}) {
  const [digits, setDigits] = useState(initial),
    [operation, setOperation] = useState<{
      left: number;
      subtract: boolean;
    } | null>(null),
    [error, setError] = useState("");
  function press(key: string) {
    setError("");
    if (key === "删除") {
      setDigits(digits.slice(0, -1));
      return;
    }
    if (key === "完成" || key === "＋" || key === "−") {
      try {
        const right = parseMinor({
            currency: "CNY",
            value: digits.replace(/\.$/, "") || "0",
          }),
          result = operation
            ? addMinor(operation.left, operation.subtract ? -right : right)
            : right;
        if (key === "完成") {
          if (result <= 0 || !digits) throw new Error("请填写大于零的金额。");
          onApply(money(result).replaceAll(",", ""));
          return;
        }
        setOperation({ left: result, subtract: key === "−" });
        setDigits("");
        return;
      } catch (cause) {
        setError(cause instanceof Error ? cause.message : "金额无效");
        return;
      }
    }
    const next =
      key === "." && !digits
        ? "0."
        : digits === "0" && key !== "."
          ? key
          : digits + key;
    if (/^\d{1,12}(\.\d{0,2})?$/.test(next)) setDigits(next);
  }
  return (
    <FormSheet title={category + " · 金额"} onClose={onClose}>
      {operation && (
        <Text>
          {money(operation.left)} {operation.subtract ? "−" : "＋"}
        </Text>
      )}
      <Text variant="displaySmall" accessibilityLiveRegion="polite">
        {digits || "0"}
      </Text>
      {error && <Text accessibilityRole="alert">{error}</Text>}
      <View style={{ flexDirection: "row", flexWrap: "wrap", gap: 4 }}>
        {[
          "7",
          "8",
          "9",
          "删除",
          "4",
          "5",
          "6",
          "＋",
          "1",
          "2",
          "3",
          "−",
          ".",
          "0",
          "00",
          "完成",
        ].map((k) => (
          <Button
            key={k}
            compact
            style={{ width: "24%" }}
            mode={k === "完成" ? "contained" : "contained-tonal"}
            contentStyle={{ minHeight: 48 }}
            onPress={() => press(k)}
          >
            {k}
          </Button>
        ))}
      </View>
    </FormSheet>
  );
}
