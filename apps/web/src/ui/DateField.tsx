import { useMediaQuery } from "@mantine/hooks";
import {
  DateInput,
  DateTimePicker,
  MonthPickerInput,
  TimeInput,
} from "@mantine/dates";
import { useId, type ReactNode } from "react";
const MONTH_KEY_LENGTH = 7;
interface DateFieldProps {
  type: "date" | "month" | "datetime-local" | "time";
  value: string;
  onChange: (value: string) => void;
  label?: ReactNode;
  "aria-label"?: string;
  className?: string;
  required?: boolean;
  disabled?: boolean;
  min?: string;
  max?: string;
}
export function DateField({
  type,
  value,
  onChange,
  min,
  max,
  ...props
}: DateFieldProps): React.JSX.Element {
  const stackId = useId();
  const isMobile = useMediaQuery("(max-width: 700px)");
  const pickerProps = {
    dropdownType: isMobile ? ("modal" as const) : ("popover" as const),
    modalProps: {
      stackId,
      title: props.label ?? "选择日期",
      withCloseButton: true,
      closeButtonProps: { "aria-label": "关闭日期选择" },
    },
    nextLabel: "下一页",
    previousLabel: "上一页",
  };

  if (type === "time")
    return (
      <TimeInput
        {...props}
        value={value}
        onChange={(event) => onChange(event.currentTarget.value)}
      />
    );
  if (type === "month")
    return (
      <MonthPickerInput
        {...pickerProps}
        {...props}
        value={value ? `${value}-01` : null}
        valueFormat="YYYY 年 MM 月"
        onChange={(next) => onChange(next?.slice(0, MONTH_KEY_LENGTH) ?? "")}
      />
    );
  if (type === "datetime-local")
    return (
      <DateTimePicker
        {...pickerProps}
        timePickerProps={{
          hoursInputLabel: "小时",
          minutesInputLabel: "分钟",
          secondsInputLabel: "秒",
        }}
        {...props}
        withSeconds
        value={value.replace("T", " ") || null}
        valueFormat="YYYY-MM-DD HH:mm:ss"
        onChange={(next) => onChange(next?.replace(" ", "T") ?? "")}
        submitButtonProps={{ "aria-label": "确认交易时间" }}
      />
    );
  return (
    <DateInput
      {...pickerProps}
      {...props}
      value={value || null}
      minDate={min}
      maxDate={max}
      valueFormat="YYYY-MM-DD"
      placeholder="YYYY-MM-DD"
      onChange={(next) => onChange(next ?? "")}
    />
  );
}
