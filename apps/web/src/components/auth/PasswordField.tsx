import { useState } from "react";
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
    <div className="auth-field">
      <label htmlFor={name}>{label}</label>
      <span className="password-control">
        <input
          id={name}
          name={name}
          type={isVisible ? "text" : "password"}
          autoComplete={autoComplete}
          required
          maxLength={512}
          value={value}
          aria-invalid={Boolean(error)}
          aria-describedby={
            error ? name + "-error" : description ? name + "-help" : undefined
          }
          onChange={(event) => onChange(event.target.value)}
        />
        <button
          type="button"
          aria-label={(isVisible ? "隐藏" : "显示") + label}
          aria-pressed={isVisible}
          onClick={() => setIsVisible(!isVisible)}
        >
          {isVisible ? <Icons.EyeOff size={20} /> : <Icons.Eye size={20} />}
        </button>
      </span>
      {description ? <small id={name + "-help"}>{description}</small> : null}
      {error ? (
        <small id={name + "-error"} className="field-error">
          {error}
        </small>
      ) : null}
    </div>
  );
}
