import { readStatement } from "../platform/browser/files";
import type { ImportSuccess } from "./ImportNotices";
import { ImportErrors } from "./ImportErrors";
import { ImportComplete, ImportHelp } from "./ImportNotices";
const COMPACT_UPLOAD_ICON_SIZE = 28;
const UPLOAD_ICON_SIZE = 42;
const RECORD_PREVIEW_LIMIT = 5;
import {
  useMemo,
  useRef,
  useState,
  type ChangeEvent,
  type DragEvent,
} from "react";
import { type Ledger, type BillRecord } from "@hamster-ledger/core";
import { parseStatement, type StatementFile } from "@hamster-ledger/importers";
import { planImport } from "@hamster-ledger/core";
import { Icons, SourceIcon } from "./Icons";
import { FieldMapping } from "./FieldMapping";
import { TransactionTable } from "./TransactionTable";
interface ImportPageProps {
  personalLedger: Ledger;
  onCommit: (ledger: Ledger) => Promise<void>;
  onReview: () => void;
  onAll: () => void;
  onSelect: (record: BillRecord) => void;
}
export function ImportPage({
  personalLedger,
  onCommit,
  onReview,
  onAll,
  onSelect,
}: ImportPageProps): React.JSX.Element {
  const [files, setFiles] = useState<StatementFile[]>([]);
  const [isLoading, setIsLoading] = useState(false);
  const [isDragging, setIsDragging] = useState(false);
  const [error, setError] = useState("");
  const [mappingHash, setMappingHash] = useState<string | null>(null);
  const [skipErrors, setSkipErrors] = useState(false);
  const [success, setSuccess] = useState<ImportSuccess | null>(null);
  const inputRef = useRef<HTMLInputElement>(null);
  const parsed = useMemo(
    () =>
      files.map((file) => ({
        file,
        ...parseStatement(file, personalLedger.rules),
      })),
    [files, personalLedger.rules],
  );
  const allRecords = useMemo(
    () => parsed.flatMap((result) => result.records),
    [parsed],
  );
  const errors = parsed.flatMap((result) =>
    result.errors.map((message) => `${result.file.name}：${message}`),
  );
  const plan = useMemo(
    () => planImport(personalLedger, allRecords),
    [personalLedger, allRecords],
  );
  async function addFiles(incoming: File[]): Promise<void> {
    setIsLoading(true);
    setError("");
    setSuccess(null);
    const knownHashes = new Set([
      ...personalLedger.files.map((file) => file.hash),
      ...files.map((file) => file.hash),
    ]);
    const addedFiles: StatementFile[] = [];
    const failures: string[] = [];
    for (const file of incoming) {
      try {
        const statement = await readStatement(file);
        if (knownHashes.has(statement.hash)) {
          failures.push(`${file.name} 已导入或已添加，本次未重复添加。`);
          continue;
        }
        knownHashes.add(statement.hash);
        addedFiles.push(statement);
      } catch (cause) {
        failures.push(
          `${file.name}：${cause instanceof Error ? cause.message : "无法读取文件"}`,
        );
      }
    }
    setFiles((current) => [...current, ...addedFiles]);
    setError(failures.join("\n"));
    setIsLoading(false);
    setSkipErrors(false);
  }
  function handleFiles(event: ChangeEvent<HTMLInputElement>): void {
    void addFiles(Array.from(event.target.files ?? []));
    event.target.value = "";
  }
  function handleDrop(event: DragEvent<HTMLDivElement>): void {
    event.preventDefault();
    setIsDragging(false);
    if (!isLoading) void addFiles(Array.from(event.dataTransfer.files));
  }
  async function handleCommit(): Promise<void> {
    try {
      await onCommit({
        ...plan.ledger,
        files: [
          ...personalLedger.files,
          ...files.map((file) => ({ name: file.name, hash: file.hash })),
        ],
      });
      setSuccess({
        added: plan.added,
        duplicate: plan.duplicate,
        pending: plan.pending,
      });
      setFiles([]);
    } catch (cause) {
      setError(cause instanceof Error ? cause.message : "导入保存失败");
    }
  }
  function updateFile(updated: StatementFile): void {
    setFiles((current) =>
      current.map((file) => (file.hash === updated.hash ? updated : file)),
    );
    setSkipErrors(false);
  }
  if (success)
    return (
      <ImportComplete
        success={success}
        onContinue={() => setSuccess(null)}
        onReview={onReview}
        onAll={onAll}
      />
    );
  return (
    <section className="import-page">
      <div className="page-heading">
        <h1>账单放进来，收支理清楚</h1>
        <p>导入到我的账本 · 文件在此浏览器解析，不上传服务器</p>
      </div>
      <ol className="import-steps">
        <li className="complete">
          <span>1</span>添加文件
        </li>
        <li className={files.length ? "active" : ""}>
          <span>2</span>识别与核对
        </li>
        <li>
          <span>3</span>完成入账
        </li>
      </ol>
      <input
        ref={inputRef}
        className="visually-hidden"
        type="file"
        aria-label="选择账单文件"
        multiple
        accept=".csv,.xlsx,.xls"
        onChange={handleFiles}
        disabled={isLoading}
      />
      <div
        className={`upload-zone ${isDragging ? "dragging" : ""} ${files.length ? "compact" : ""}`}
        onDragOver={(event) => {
          event.preventDefault();
          setIsDragging(true);
        }}
        onDragLeave={() => setIsDragging(false)}
        onDrop={handleDrop}
      >
        <Icons.Upload
          size={files.length ? COMPACT_UPLOAD_ICON_SIZE : UPLOAD_ICON_SIZE}
          weight="duotone"
        />
        <h2>{isLoading ? "正在读取账单…" : "把账单拖到这里"}</h2>
        <p>支持支付宝、微信、招行及通用银行表格</p>
        <button
          className="primary-button"
          onClick={() => inputRef.current?.click()}
          disabled={isLoading}
        >
          {isLoading ? "读取中…" : "选择账单文件"}
        </button>
        <small>CSV / XLSX / XLS · 单文件最多 10 MB、15,000 行</small>
      </div>
      {error ? (
        <p className="error-message" role="alert">
          {error}
        </p>
      ) : null}
      {!files.length ? (
        <ImportHelp />
      ) : (
        <>
          <div className="section-heading import-file-heading">
            <h2>本次导入</h2>
            <span>
              {files.length} 个文件 · {allRecords.length} 条有效记录
            </span>
          </div>
          <div className="file-list">
            {parsed.map(({ file, records, errors: fileErrors }) => (
              <div key={file.hash}>
                <div className="file-row">
                  <SourceIcon source={file.source} />
                  <div className="file-name">
                    <strong>{file.name}</strong>
                    <small>
                      {file.source} · {records.length} 条识别成功
                      {fileErrors.length
                        ? ` · ${fileErrors.length} 行需处理`
                        : ""}
                    </small>
                  </div>
                  <button
                    className="text-button"
                    onClick={() =>
                      setMappingHash(
                        mappingHash === file.hash ? null : file.hash,
                      )
                    }
                    aria-expanded={mappingHash === file.hash}
                  >
                    <Icons.Settings size={18} />
                    调整字段
                  </button>
                  <button
                    className="icon-button"
                    aria-label={`移除 ${file.name}`}
                    onClick={() =>
                      setFiles((current) =>
                        current.filter((item) => item.hash !== file.hash),
                      )
                    }
                  >
                    <Icons.Close size={19} />
                  </button>
                </div>
                {mappingHash === file.hash ? (
                  <FieldMapping file={file} onChange={updateFile} />
                ) : null}
              </div>
            ))}
          </div>
          <ImportErrors
            errors={errors}
            skipErrors={skipErrors}
            onSkip={setSkipErrors}
          />
          <div className="import-summary">
            <div>
              <span>可入账</span>
              <strong>{plan.added}</strong>
            </div>
            <div>
              <span>重复记录</span>
              <strong>{plan.duplicate}</strong>
            </div>
            <div>
              <span>待确认</span>
              <strong>{plan.pending}</strong>
            </div>
          </div>
          <div className="section-heading">
            <h2>识别预览</h2>
            <span>最多展示前 5 条</span>
          </div>
          <TransactionTable
            records={allRecords.slice(0, RECORD_PREVIEW_LIMIT)}
            onSelect={onSelect}
          />
          <div className="import-bottom">
            <p>
              相同流水号自动去重，疑似跨平台重复将在入账后等待核对。
              <br />
              内部转账、还款不计入收支；无法判断的收支方向保留为待确认。
            </p>
            <button
              className="primary-button"
              onClick={handleCommit}
              disabled={
                !allRecords.length ||
                isLoading ||
                (errors.length > 0 && !skipErrors)
              }
            >
              确认导入 {allRecords.length} 条<Icons.Arrow size={18} />
            </button>
          </div>
        </>
      )}
    </section>
  );
}
