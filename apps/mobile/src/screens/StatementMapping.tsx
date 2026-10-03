import { useEffect, useMemo, useState } from "react";
import { Button, TextInput, Text, HelperText } from "react-native-paper";
import {
  FIELD_LABELS,
  FIELDS,
  changeHeader,
  detectStatementLayout,
  mappingColumns,
  mappingNeedsReview,
  validateMapping,
  type StatementFile,
} from "@hamster-ledger/importers";
import { SOURCES, type Source } from "@hamster-ledger/core";
import { FormSheet } from "../ui/FormSheet";
import { ChoiceField } from "../ui/ChoiceField";
interface StatementMappingProps {
  file: StatementFile;
  onChange: (file: StatementFile) => void;
  onClose: () => void;
}
export function StatementMapping({
  file,
  onChange,
  onClose,
}: StatementMappingProps): React.JSX.Element {
  const [headerRow, setHeaderRow] = useState(String(file.headerIndex + 1));
  const [error, setError] = useState("");
  useEffect(() => {
    setHeaderRow(String(file.headerIndex + 1));
    setError("");
  }, [file.headerIndex]);
  const columns = useMemo(
    () => mappingColumns(file),
    [file.rows, file.headerIndex],
  );
  const needsReview = mappingNeedsReview(file);
  const mappingError = validateMapping(file);
  return (
    <FormSheet title="核对账单字段" onClose={onClose}>
      <Text>{file.name}</Text>
      <Text>
        当前使用第 {file.headerIndex + 1} 行表头。每个选项都附有原始数据样例。
      </Text>
      <Button
        mode="outlined"
        onPress={() => {
          const layout = detectStatementLayout(file.rows);
          onChange({
            ...file,
            ...layout,
            mappingConfirmed: layout.reviewFields.length === 0,
          });
          setHeaderRow(String(layout.headerIndex + 1));
          setError("");
        }}
      >
        重新自动识别
      </Button>
      {needsReview ? (
        <Text accessibilityLiveRegion="polite">
          请核对自动推断的{" "}
          {file.reviewFields?.map((field) => FIELD_LABELS[field]).join("、")}
          ，确认后才能导入。
        </Text>
      ) : null}
      <ChoiceField
        label="账单来源"
        value={file.source}
        options={SOURCES.map((value) => ({ value, label: value }))}
        onChange={(value) => onChange({ ...file, source: value as Source })}
      />
      <TextInput
        label="表头所在行"
        accessibilityLabel="表头所在行"
        value={headerRow}
        keyboardType="number-pad"
        mode="outlined"
        onChangeText={setHeaderRow}
      />
      <Text>可填写第 1 至 {file.rows.length} 行，不受预览行数限制。</Text>
      <Button
        mode="outlined"
        onPress={() => {
          try {
            onChange(changeHeader(file, Number(headerRow) - 1));
            setError("");
          } catch (cause) {
            setError(cause instanceof Error ? cause.message : "表头设置失败。");
          }
        }}
      >
        应用表头行
      </Button>
      <TextInput
        accessibilityLabel="默认付款账户"
        mode="outlined"
        label="默认付款账户"
        value={file.account}
        onChangeText={(value) => onChange({ ...file, account: value })}
      />
      {error || mappingError ? (
        <HelperText type="error" visible accessibilityLiveRegion="assertive">
          {error || mappingError}
        </HelperText>
      ) : null}
      {FIELDS.map((field) => (
        <ChoiceField
          key={field}
          label={FIELD_LABELS[field]}
          value={String(file.mapping[field] ?? "")}
          options={[
            { value: "", label: "未设置" },
            ...columns.map((column) => ({
              value: String(column.index),
              label: column.label,
            })),
          ]}
          onChange={(value) =>
            onChange({
              ...file,
              mapping: {
                ...file.mapping,
                [field]: value === "" ? undefined : Number(value),
              },
              mappingConfirmed: false,
            })
          }
        />
      ))}
      {file.reviewFields?.length ? (
        <Button
          mode="contained"
          disabled={Boolean(mappingError)}
          onPress={() => onChange({ ...file, mappingConfirmed: true })}
        >
          {needsReview ? "确认字段映射" : "字段映射已确认"}
        </Button>
      ) : null}
      <Button mode="outlined" onPress={onClose}>
        返回导入预览
      </Button>
    </FormSheet>
  );
}
