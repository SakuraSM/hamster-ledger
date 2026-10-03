import { ActionIcon, Button } from "@mantine/core";
import type { BillRecord } from "@hamster-ledger/core";
import {
  mappingNeedsReview,
  type StatementFile,
} from "@hamster-ledger/importers";
import { FieldMapping } from "./FieldMapping";
import { Icons, SourceIcon } from "./Icons";
interface ImportFileListProps {
  files: Array<{
    file: StatementFile;
    records: BillRecord[];
    errors: string[];
  }>;
  mappingHash: string | null;
  onToggle: (hash: string) => void;
  onRemove: (hash: string) => void;
  onChange: (file: StatementFile) => void;
}
export function ImportFileList({
  files,
  mappingHash,
  onToggle,
  onRemove,
  onChange,
}: ImportFileListProps): React.JSX.Element {
  return (
    <div className="file-list">
      {files.map(({ file, records, errors }) => (
        <div key={file.hash}>
          <div className="file-row">
            <SourceIcon source={file.source} />
            <div className="file-name">
              <strong>{file.name}</strong>
              <small>
                {file.source} · 表头第 {file.headerIndex + 1} 行 ·{" "}
                {records.length} 条识别成功
                {errors.length ? ` · ${errors.length} 项需处理` : ""}
                {mappingNeedsReview(file) ? " · 字段待确认" : ""}
              </small>
            </div>
            <Button
              variant="subtle"
              type="button"
              className="text-button"
              onClick={() => onToggle(file.hash)}
              aria-expanded={mappingHash === file.hash}
            >
              <Icons.Settings size={18} />
              调整字段
            </Button>
            <ActionIcon
              variant="subtle"
              size="lg"
              type="button"
              className="icon-button"
              aria-label={`移除 ${file.name}`}
              onClick={() => onRemove(file.hash)}
            >
              <Icons.Close size={19} />
            </ActionIcon>
          </div>
          {mappingHash === file.hash ? (
            <FieldMapping file={file} onChange={onChange} />
          ) : null}
        </div>
      ))}
    </div>
  );
}
