import { MIN_TOUCH_TARGET } from "../constants";
import { useState } from "react";
import { View } from "react-native";
import { Button, Text, useTheme } from "react-native-paper";
import {
  allocationRows,
  allocationGroups,
  money,
  type summarizeAssets,
} from "@hamster-ledger/core";
import { AtlasBand } from "../ui/AtlasBand";
import { FormSheet } from "../ui/FormSheet";
export function AssetAllocation({
  totals,
  hidden,
  onAccount,
}: {
  totals: ReturnType<typeof summarizeAssets>;
  hidden: boolean;
  onAccount: (id: string) => void;
}) {
  const [open, setOpen] = useState(false),
    [mode, setMode] = useState("资产"),
    theme = useTheme();
  const partial = Boolean(
    totals.missingCurrencies.length || totals.missingBaselines.length,
  );
  function chart(debt: boolean, onTint = false) {
    const textStyle = { color: onTint ? "#ffffff" : theme.colors.onSurface };
    const total = debt ? totals.liabilities : totals.assets,
      groups = allocationGroups(allocationRows(totals.balances, debt));
    return hidden ? (
      <Text style={textStyle}>金额与占比已隐藏</Text>
    ) : total > 0 ? (
      <>
        <AtlasBand groups={groups} />
        <Text style={textStyle} variant="bodySmall">
          {groups
            .map(
              (g) => g.label + " " + ((100 * g.value) / total).toFixed(1) + "%",
            )
            .join("　")}
        </Text>
        {partial && (
          <Text style={textStyle} variant="bodySmall">
            仅含已估值账户
          </Text>
        )}
      </>
    ) : (
      <Text style={textStyle}>
        {partial ? "估值待补全" : "暂无" + (debt ? "负债" : "资产") + "余额"}
      </Text>
    );
  }
  return (
    <View
      style={{
        backgroundColor: theme.dark ? "#40304c" : "#382c42",
        paddingHorizontal: 12,
        paddingBottom: 8,
        borderRadius: 12,
        gap: 3,
      }}
    >
      <View
        style={{
          flexDirection: "row",
          justifyContent: "space-between",
          alignItems: "center",
        }}
      >
        <Text
          style={{ color: "#ffffff" }}
          variant="titleSmall"
          accessibilityRole="header"
        >
          资产构成
        </Text>
        <Button
          contentStyle={{ minHeight: MIN_TOUCH_TARGET }}
          textColor="#ffffff"
          compact
          onPress={() => setOpen(true)}
        >
          资产分析
        </Button>
      </View>
      {chart(false, true)}
      {open && (
        <FormSheet title="资产分析" onClose={() => setOpen(false)}>
          <View style={{ flexDirection: "row", flexWrap: "wrap" }}>
            {["资产", "负债", "净资产"].map((k) => (
              <Button
                contentStyle={{ minHeight: MIN_TOUCH_TARGET }}
                key={k}
                mode={mode === k ? "contained-tonal" : "text"}
                accessibilityState={{ selected: k === mode }}
                onPress={() => setMode(k)}
              >
                {k}
              </Button>
            ))}
          </View>
          {mode === "净资产" ? (
            <>
              <Text>
                总资产　{hidden ? "••••" : "¥" + money(totals.assets)}
              </Text>
              <Text>
                总负债　{hidden ? "••••" : "¥" + money(totals.liabilities)}
              </Text>
              <Text>
                资产负债率　
                {hidden
                  ? "••••"
                  : totals.assets && !partial
                    ? ((100 * totals.liabilities) / totals.assets).toFixed(1) +
                      "%"
                    : "—"}
              </Text>
            </>
          ) : (
            <>
              {chart(mode === "负债")}
              {!hidden && (
                <>
                  <Text accessibilityRole="header">{mode}账户排行</Text>
                  {allocationRows(totals.balances, mode === "负债").map((r) => (
                    <Button
                      contentStyle={{ minHeight: MIN_TOUCH_TARGET }}
                      key={r.account.id}
                      onPress={() => {
                        setOpen(false);
                        onAccount(r.account.id);
                      }}
                    >
                      {r.account.name}　¥{money(r.value)}
                    </Button>
                  ))}
                </>
              )}
            </>
          )}
        </FormSheet>
      )}
    </View>
  );
}
