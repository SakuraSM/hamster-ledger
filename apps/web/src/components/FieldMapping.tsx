const HEADER_PREVIEW_LIMIT = 30;
const HEADER_PREVIEW_COLUMNS = 3;
const HEADER_PREVIEW_LENGTH = 45;
import {
  FIELD_LABELS,
  mapHeaders,
  type Field,
  type StatementFile,
} from "@hamster-ledger/importers";
import { SOURCES, type Source } from "@hamster-ledger/core";
interface FieldMappingProps {
  file: StatementFile;
  onChange: (file: StatementFile) => void;
}
const FIELDS = Object.keys(FIELD_LABELS) as Field[];
export function FieldMapping({
  file,
  onChange,
}: FieldMappingProps): React.JSX.Element {
  return (
    <div className="mapping-panel">
      <div className="form-grid">
        <label>
          账单来源
          <select
            value={file.source}
            onChange={(event) =>
              onChange({ ...file, source: event.target.value as Source })
            }
          >
            {SOURCES.map((source) => (
              <option key={source}>{source}</option>
            ))}
          </select>
        </label>
        <label>
          表头所在行
          <select
            value={file.headerIndex}
            onChange={(event) => {
              const headerIndex = Number(event.target.value);
              onChange({
                ...file,
                headerIndex,
                mapping: mapHeaders(file.rows[headerIndex]),
              });
            }}
          >
            {file.rows.slice(0, HEADER_PREVIEW_LIMIT).map((row, index) => (
              <option key={index} value={index}>
                第 {index + 1} 行 ·{" "}
                {row
                  .slice(0, HEADER_PREVIEW_COLUMNS)
                  .join(" / ")
                  .slice(0, HEADER_PREVIEW_LENGTH)}
              </option>
            ))}
          </select>
        </label>
        <label className="full-width">
          默认付款账户
          <input
            placeholder="如：招商银行 · 6628（账单没有账户列时使用）"
            value={file.account}
            onChange={(event) =>
              onChange({ ...file, account: event.target.value })
            }
          />
        </label>
      </div>
      <div className="field-map-grid">
        {FIELDS.map((field) => (
          <label key={field}>
            {FIELD_LABELS[field]}
            <select
              value={file.mapping[field] ?? ""}
              onChange={(event) =>
                onChange({
                  ...file,
                  mapping: {
                    ...file.mapping,
                    [field]:
                      event.target.value === ""
                        ? undefined
                        : Number(event.target.value),
                  },
                })
              }
            >
              <option value="">未设置</option>
              {file.rows[file.headerIndex].map((header, index) => (
                <option key={index} value={index}>
                  {header || `第 ${index + 1} 列`}
                </option>
              ))}
            </select>
          </label>
        ))}
      </div>
    </div>
  );
}
