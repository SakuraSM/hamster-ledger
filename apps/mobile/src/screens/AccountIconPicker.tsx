import { useState } from "react";
import { View } from "react-native";
import { Button, TextInput, Text } from "react-native-paper";
import { accountIconLabels, type AccountIconKey } from "@hamster-ledger/core";
import { FormSheet } from "../ui/FormSheet";
import { accountGlyphs } from "./account-glyphs";
export function AccountIconPicker({
  value,
  onChange,
}: {
  value?: AccountIconKey;
  onChange: (key: AccountIconKey | undefined) => void;
}) {
  const [open, setOpen] = useState(false),
    [query, setQuery] = useState("");
  function pick(key?: AccountIconKey) {
    onChange(key);
    setOpen(false);
  }
  const opts = (Object.keys(accountIconLabels) as AccountIconKey[]).filter(
    (k) => accountIconLabels[k].includes(query.trim()),
  );
  return (
    <>
      <Button
        mode="outlined"
        onPress={() => {
          setQuery("");
          setOpen(true);
        }}
      >
        账户图标 · {value ? accountIconLabels[value] : "跟随账户类型"}
      </Button>
      {open && (
        <FormSheet title="选择账户图标" onClose={() => setOpen(false)}>
          <TextInput label="搜索图标" value={query} onChangeText={setQuery} />
          <Button onPress={() => pick()}>跟随账户类型</Button>
          <View style={{ flexDirection: "row", flexWrap: "wrap", gap: 8 }}>
            {opts.map((k) => {
              const Icon = accountGlyphs[k];
              return (
                <Button
                  key={k}
                  accessibilityState={{ selected: k === value }}
                  mode={k === value ? "contained" : "outlined"}
                  icon={({ size, color }) => <Icon size={size} color={color} />}
                  onPress={() => pick(k)}
                >
                  {accountIconLabels[k]}
                </Button>
              );
            })}
          </View>
          {!opts.length && <Text>没有匹配图标</Text>}
        </FormSheet>
      )}
    </>
  );
}
