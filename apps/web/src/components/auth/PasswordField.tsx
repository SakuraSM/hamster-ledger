import { useState } from "react";
import { PasswordInput } from "@mantine/core";
import { Icons } from "../Icons";
interface Props {
  label: string;
  name: string;
  value: string;
  onChange: (value: string) => void;
  autoComplete: "current-password" | "new-password";
  description?: string;
  error?: string;
}
export function PasswordField({
  label,
  name,
  value,
  onChange,
  autoComplete,
  description,
  error,
}: Props): React.JSX.Element {
  const [isVisible, setIsVisible] = useState(false);
  return (
    <PasswordInput
      className="auth-field"
      id={name}
      name={name}
      label={label}
      description={description}
      error={error}
      required
      maxLength={512}
      value={value}
      onChange={(event) => onChange(event.currentTarget.value)}
      autoComplete={autoComplete}
      visibilityToggleFocusable
      visible={isVisible}
      onVisibilityChange={setIsVisible}
      visibilityToggleIcon={({ reveal }) =>
        reveal ? <Icons.EyeOff size={20} /> : <Icons.Eye size={20} />
      }
      visibilityToggleButtonProps={{
        "aria-label": (isVisible ? "隐藏" : "显示") + label,
        "aria-pressed": isVisible,
      }}
    />
  );
}
