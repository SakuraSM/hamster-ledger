import { useEffect, useMemo, useState } from "react";
import { Button, NumberInput, TextInput, Alert, Table } from "@mantine/core";
import { Choice } from "../ui/Choice";
import {
  FIELD_LABELS,
  FIELDS,
  changeHeader,
  detectStatementLayout,
  mappingColumns,
  mappingNeedsReview,
  validateMapping,
  type Field,
  type StatementFile,
} from "@hamster-ledger/importers";
import { SOURCES, type Source } from "@hamster-ledger/core";
const PREVIEW_ROWS = 3;
const FIRST_DATA_ROW_OFFSET = 2;
const PREVIEW_CELL_LENGTH = 48;
interface FieldMappingProps {
  file: StatementFile;
  onChange: (file: StatementFile) => void;
}
export function FieldMapping({
  file,
  onChange,
}: FieldMappingProps): React.JSX.Element {
  const [headerRow, setHeaderRow] = useState<string | number>(
    file.headerIndex + 1,
  );
  const [error, setError] = useState("");
  useEffect(() => {
    setHeaderRow(file.headerIndex + 1);
    setError("");
  }, [file.headerIndex]);
  const columns = useMemo(
    () => mappingColumns(file),
    [file.rows, file.headerIndex],
  );
  const needsReview = mappingNeedsReview(file);
  const mappingError = validateMapping(file);
  function applyHeader(): void {
    try {
      onChange(changeHeader(file, Number(headerRow) - 1));
      setError("");
    } catch (cause) {
      setError(cause instanceof Error ? cause.message : "表头设置失败。");
    }
  }
  function updateField(field: Field, value: string): void {
    onChange({
      ...file,
      mapping: {
        ...file.mapping,
        [field]: value === "" ? undefined : Number(value),
      },
      mappingConfirmed: false,
    });
  }
  return (
    <div className="mapping-panel">
      <div className="section-heading">
        <h3>核对表头和字段</h3>
        <Button
          variant="subtle"
          type="button"
          onClick={() => {
            const layout = detectStatementLayout(file.rows);
            onChange({
              ...file,
              ...layout,
              mappingConfirmed: layout.reviewFields.length === 0,
            });
            setHeaderRow(layout.headerIndex + 1);
            setError("");
          }}
        >
          重新自动识别
        </Button>
      </div>
      <p className="muted">
        当前使用第 {file.headerIndex + 1}{" "}
        行表头。可填写任意行号，并按数据样例调整对应列。
      </p>
      {needsReview ? (
        <Alert
          className="mapping-review-alert"
          color="orange"
          title="自动推断的字段需要确认"
        >
          请核对{" "}
          {file.reviewFields?.map((field) => FIELD_LABELS[field]).join("、")}
          。确认前不会计入收支或导入账本。
        </Alert>
      ) : null}
      <div className="form-grid">
        <Choice
          label="账单来源"
          value={file.source}
          onChange={(value) => onChange({ ...file, source: value as Source })}
        >
          {SOURCES.map((source) => (
            <option key={source}>{source}</option>
          ))}
        </Choice>
        <div className="header-row-control">
          <NumberInput
            label="表头所在行"
            value={headerRow}
            onChange={setHeaderRow}
            min={1}
            max={file.rows.length}
            allowDecimal={false}
            allowNegative={false}
            description={`可选第 1 至 ${file.rows.length} 行`}
          />
          <Button variant="outline" type="button" onClick={applyHeader}>
            应用表头行
          </Button>
        </div>
        <TextInput
          label="默认付款账户"
          className="full-width"
          placeholder="账单没有账户列时使用"
          value={file.account}
          onChange={(event) =>
            onChange({ ...file, account: event.target.value })
          }
        />
      </div>
      {error || mappingError ? (
        <p role="alert" className="error-message">
          {error || mappingError}
        </p>
      ) : null}
      <div className="field-map-grid">
        {FIELDS.map((field) => (
          <Choice
            label={FIELD_LABELS[field]}
            key={field}
            value={file.mapping[field] ?? ""}
            onChange={(value) => updateField(field, value)}
          >
            <option value="">未设置</option>
            {columns.map((column) => (
              <option key={column.index} value={column.index}>
                {column.label}
              </option>
            ))}
          </Choice>
        ))}
      </div>
      <div
        className="mapping-preview"
        tabIndex={0}
        role="region"
        aria-label="表头与原始数据样例"
      >
        <Table>
          <Table.Thead>
            <Table.Tr>
              <Table.Th>行号</Table.Th>
              {columns.map((column) => (
                <Table.Th key={column.index}>
                  第 {column.index + 1} 列 · {column.header}
                </Table.Th>
              ))}
            </Table.Tr>
          </Table.Thead>
          <Table.Tbody>
            {file.rows
              .slice(file.headerIndex + 1, file.headerIndex + PREVIEW_ROWS + 1)
              .map((row, index) => (
                <Table.Tr key={index}>
                  <Table.Td>
                    {file.headerIndex + index + FIRST_DATA_ROW_OFFSET}
                  </Table.Td>
                  {columns.map((column) => (
                    <Table.Td key={column.index} title={row[column.index]}>
                      {row[column.index]?.slice(0, PREVIEW_CELL_LENGTH) || "—"}
                    </Table.Td>
                  ))}
                </Table.Tr>
              ))}
          </Table.Tbody>
        </Table>
      </div>
      {file.reviewFields?.length ? (
        <Button
          type="button"
          disabled={Boolean(mappingError)}
          onClick={() => onChange({ ...file, mappingConfirmed: true })}
        >
          {needsReview ? "确认字段映射" : "字段映射已确认"}
        </Button>
      ) : null}
    </div>
  );
}
