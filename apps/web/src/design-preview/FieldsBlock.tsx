import { useId, useState } from "react";
import { DesignIcon } from "./icons";
import type { BlockProps, VisualItem } from "./model";
const TOGGLE_STATES = new Set(["开", "关", "已勾选", "未勾选"]);
function Field({ item }: { item: VisualItem }): React.JSX.Element {
  const id = useId();
  const [isChecked, setChecked] = useState(
    !item.value?.includes("关") && !item.value?.includes("未"),
  );
  const isIssuedToken = item.type === "password" && Boolean(item.value);
  const secretPlaceholder = item.label.includes("密钥")
    ? "请输入密钥"
    : item.label.includes("令牌")
      ? "一次性令牌"
      : "请输入密码";
  const statusLabel = TOGGLE_STATES.has(item.value ?? "")
    ? item.value === "开" || item.value === "关"
      ? isChecked
        ? "开"
        : "关"
      : isChecked
        ? "已勾选"
        : "未勾选"
    : item.value;
  if (item.type === "toggle")
    return (
      <label className="toggle-field" htmlFor={id}>
        <span>
          {item.label}
          <small>{statusLabel}</small>
        </span>
        <input
          id={id}
          type="checkbox"
          checked={isChecked}
          onChange={(event) => setChecked(event.target.checked)}
        />
      </label>
    );
  return (
    <label className="field" htmlFor={id}>
      <span>{item.label}</span>
      {item.type === "select" ? (
        <span className="field-select">
          <select id={id} defaultValue={item.value}>
            <option>{item.value}</option>
            <option>稍后选择</option>
          </select>
          <DesignIcon name="chevron" size={16} />
        </span>
      ) : (
        <input
          id={id}
          type={item.type === "password" ? "password" : "text"}
          placeholder={item.type === "password" ? secretPlaceholder : "请填写"}
          defaultValue={
            item.type === "password" && !isIssuedToken ? "" : item.value
          }
          readOnly={isIssuedToken}
          autoComplete="off"
        />
      )}
      {item.note ? <small>{item.note}</small> : null}
    </label>
  );
}
export function FieldsBlock({ block }: BlockProps): React.JSX.Element {
  return (
    <section className="block fields-block">
      {block.heading ? <h2>{block.heading}</h2> : null}
      {block.items?.map((item) => (
        <Field key={item.label} item={item} />
      ))}
    </section>
  );
}
