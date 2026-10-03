import { useState } from "react";
import { TextInput } from "react-native-paper";
export function PasswordInput({
  label,
  value,
  onChangeText,
  isNew = false,
  disabled = false,
}: {
  label: string;
  value: string;
  onChangeText: (value: string) => void;
  isNew?: boolean;
  disabled?: boolean;
}): React.JSX.Element {
  const [visible, setVisible] = useState(false);
  return (
    <TextInput
      label={label}
      accessibilityLabel={label}
      mode="outlined"
      value={value}
      disabled={disabled}
      onChangeText={onChangeText}
      secureTextEntry={!visible}
      autoCapitalize="none"
      autoCorrect={false}
      autoComplete={isNew ? "new-password" : "current-password"}
      right={
        <TextInput.Icon
          icon={visible ? "eye-off" : "eye"}
          accessibilityLabel={(visible ? "隐藏" : "显示") + label}
          onPress={() => setVisible(!visible)}
        />
      }
    />
  );
}
