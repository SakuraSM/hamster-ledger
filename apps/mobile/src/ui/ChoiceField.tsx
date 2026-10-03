import { useState } from "react";
import { FlatList } from "react-native";
import { Button, RadioButton, Searchbar } from "react-native-paper";
import { FormSheet } from "./FormSheet";
interface ChoiceOption {
  value: string;
  label: string;
  disabled?: boolean;
}
interface ChoiceFieldProps {
  label: string;
  value: string;
  options: ChoiceOption[];
  onChange: (value: string) => void;
  disabled?: boolean;
}
export function ChoiceField({
  label,
  value,
  options,
  onChange,
  disabled,
}: ChoiceFieldProps): React.JSX.Element {
  const [isOpen, setIsOpen] = useState(false);
  const [query, setQuery] = useState("");
  const current = options.find((option) => option.value === value);
  return (
    <>
      <Button
        mode="outlined"
        icon="chevron-down"
        disabled={disabled}
        accessibilityLabel={`${label}：${current?.label ?? "请选择"}`}
        onPress={() => {
          setQuery("");
          setIsOpen(true);
        }}
        contentStyle={{ minHeight: 48 }}
        style={{ marginBottom: 12 }}
      >
        {label}：{current?.label ?? "请选择"}
      </Button>
      {isOpen ? (
        <FormSheet title={label} onClose={() => setIsOpen(false)}>
          <Searchbar
            icon="magnify"
            clearIcon="close"
            searchAccessibilityLabel="搜索"
            clearAccessibilityLabel="清空搜索"
            placeholder="搜索选项"
            accessibilityLabel="搜索选项"
            value={query}
            onChangeText={setQuery}
          />
          <FlatList
            scrollEnabled={false}
            data={options.filter((option) =>
              option.label.toLowerCase().includes(query.toLowerCase()),
            )}
            keyExtractor={(option) => option.value}
            renderItem={({ item }) => (
              <RadioButton.Item
                label={item.label}
                value={item.value}
                disabled={item.disabled}
                status={item.value === value ? "checked" : "unchecked"}
                onPress={() => {
                  onChange(item.value);
                  setIsOpen(false);
                }}
              />
            )}
          />
        </FormSheet>
      ) : null}
    </>
  );
}
