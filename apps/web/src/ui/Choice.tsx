import { Children, isValidElement, type ReactNode } from "react";
import { Select, type SelectProps, type ComboboxItem } from "@mantine/core";

interface ChoiceProps extends Omit<
  SelectProps<string>,
  "data" | "value" | "onChange" | "children"
> {
  children: ReactNode;
  value: string | number;
  onChange: (value: string) => void;
}
interface OptionProps {
  children?: ReactNode;
  value?: string | number;
  disabled?: boolean;
}

function optionText(children: ReactNode): string {
  return Children.toArray(children)
    .map((child) =>
      isValidElement<OptionProps>(child)
        ? optionText(child.props.children)
        : String(child),
    )
    .join("");
}
function optionsFromChildren(children: ReactNode): ComboboxItem[] {
  return Children.toArray(children).flatMap((child) => {
    if (!isValidElement<OptionProps>(child)) return [];
    if (child.type !== "option")
      return optionsFromChildren(child.props.children);
    const label = optionText(child.props.children);
    return [
      {
        value: String(child.props.value ?? label),
        label,
        disabled: child.props.disabled,
      },
    ];
  });
}

/** Declarative option adapter: Mantine owns the combobox, keyboard and focus behavior. */
export function Choice({
  children,
  value,
  onChange,
  ...props
}: ChoiceProps): React.JSX.Element {
  return (
    <Select<string>
      searchable
      allowDeselect={false}
      {...props}
      value={String(value)}
      data={optionsFromChildren(children)}
      onChange={(next) => {
        if (next !== null) onChange(next);
      }}
    />
  );
}
