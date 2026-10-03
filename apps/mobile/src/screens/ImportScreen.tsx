import { DATE_KEY_LENGTH } from "../constants";
const IMPORT_PREVIEW_LIMIT = 5;
const ERROR_PREVIEW_LIMIT = 10;
import { useMemo, useState } from "react";
import { Button, Card, Checkbox, Text, ProgressBar } from "react-native-paper";
import type { LedgerController } from "@hamster-ledger/ledger-react";
import { planImport, money } from "@hamster-ledger/core";
import {
  parseStatement,
  mappingNeedsReview,
  type StatementFile,
} from "@hamster-ledger/importers";
import { pickStatements, readStatement } from "../platform/files";
import { Screen, Section, ErrorMessage } from "../ui/Screen";
import { StatementMapping } from "./StatementMapping";
interface ImportScreenProps {
  controller: LedgerController;
  onReview: () => void;
}
export function ImportScreen({
  controller,
  onReview,
}: ImportScreenProps): React.JSX.Element {
  const [files, setFiles] = useState<StatementFile[]>([]);
  const [mapping, setMapping] = useState<string | null>(null);
  const [error, setError] = useState("");
  const [isReading, setIsReading] = useState(false);
  const [shouldSkipErrors, setShouldSkipErrors] = useState(false);
  const [message, setMessage] = useState("");
  const parsed = useMemo(
    () =>
      files.map((file) => ({
        file,
        ...parseStatement(file, controller.ledger.rules),
      })),
    [files, controller.ledger.rules],
  );
  const needsMappingReview = files.some(mappingNeedsReview);
  const records = parsed.flatMap((item) => item.records);
  const errors = parsed.flatMap((item) =>
    item.errors.map((problem) => `${item.file.name}：${problem}`),
  );
  const plan = useMemo(
    () =>
      planImport(
        controller.ledger,
        parsed.flatMap((item) => item.records),
      ),
    [controller.ledger, parsed],
  );
  async function choose(): Promise<void> {
    setIsReading(true);
    setError("");
    setMessage("");
    try {
      const selected = await pickStatements();
      const known = new Set([
        ...controller.ledger.files.map((file) => file.hash),
        ...files.map((file) => file.hash),
      ]);
      const added: StatementFile[] = [];
      for (const asset of selected) {
        const file = await readStatement(asset);
        if (known.has(file.hash))
          throw new Error(`${file.name} 已添加或导入，不会重复处理。`);
        known.add(file.hash);
        added.push(file);
      }
      setFiles((current) => [...current, ...added]);
      const needsAdjustment = added.find(
        (file) =>
          mappingNeedsReview(file) ||
          !parseStatement(file, controller.ledger.rules).records.length,
      );
      if (needsAdjustment) setMapping(needsAdjustment.hash);
      setShouldSkipErrors(false);
    } catch (cause) {
      setError(
        cause instanceof Error ? cause.message : "读取失败，账本未修改。",
      );
    } finally {
      setIsReading(false);
    }
  }
  async function commit(): Promise<void> {
    if (needsMappingReview) {
      setError("请先核对并确认自动推断的字段。");
      return;
    }
    try {
      const current = planImport(controller.ledger, records);
      await controller.commit({
        ...current.ledger,
        files: [
          ...controller.ledger.files,
          ...files.map((file) => ({
            name: file.name,
            hash: file.hash,
            source: file.source,
          })),
        ],
      });
      setMessage(
        `已导入 ${current.added} 条，识别 ${current.duplicate} 条重复、${current.pending} 条待确认。`,
      );
      setFiles([]);
      setError("");
    } catch (cause) {
      setError(cause instanceof Error ? cause.message : "导入失败");
    }
  }
  const mappingFile = files.find((file) => file.hash === mapping);
  if (controller.mode === "demo")
    return (
      <Screen>
        <Text variant="headlineSmall" accessibilityRole="header">
          导入账单
        </Text>
        <Text>真实账单会保存在「我的账本」，与示例数据分开。</Text>
        <Button
          mode="contained"
          onPress={() => controller.switchMode("personal")}
        >
          使用我的账本导入
        </Button>
      </Screen>
    );
  return (
    <>
      <Screen>
        <Text variant="headlineSmall" accessibilityRole="header">
          导入账单
        </Text>
        <Text>
          支持支付宝、微信与银行 CSV / Excel。单文件最多 10 MB、15,000
          行，内容在本机处理。
        </Text>
        <Text>
          导入到：
          {controller.books.find((book) => book.id === controller.mode)?.name}
        </Text>
        <Button
          mode="contained"
          icon="file-upload-outline"
          loading={isReading}
          disabled={isReading || controller.isSaving}
          onPress={() => void choose()}
        >
          选择账单文件
        </Button>
        {isReading ? <ProgressBar indeterminate /> : null}
        <ErrorMessage message={error} />
        {parsed.map((item) => (
          <Card key={item.file.hash} mode="outlined">
            <Card.Content>
              <Text variant="titleMedium">{item.file.name}</Text>
              <Text>
                {item.file.source} · 表头第 {item.file.headerIndex + 1} 行 ·{" "}
                {item.records.length} 条可识别流水
                {mappingNeedsReview(item.file) ? " · 字段待确认" : ""}
              </Text>
              <Button onPress={() => setMapping(item.file.hash)}>
                核对字段
              </Button>
              <Button
                onPress={() =>
                  setFiles(files.filter((file) => file.hash !== item.file.hash))
                }
              >
                移除文件
              </Button>
            </Card.Content>
          </Card>
        ))}
        {errors.length ? (
          <Section title={`${errors.length} 行无法识别`}>
            <Text>{errors.slice(0, ERROR_PREVIEW_LIMIT).join("\n")}</Text>
            <Checkbox.Item
              label="跳过错误行，仅导入有效记录"
              status={shouldSkipErrors ? "checked" : "unchecked"}
              onPress={() => setShouldSkipErrors(!shouldSkipErrors)}
            />
          </Section>
        ) : null}
        {files.length ? (
          <Section title="导入预览">
            <Text>
              {plan.added} 条新增 · {plan.duplicate} 条重复 · {plan.pending}{" "}
              条待确认
            </Text>
            {records.slice(0, IMPORT_PREVIEW_LIMIT).map((record) => (
              <Text key={record.id}>
                {record.date.slice(0, DATE_KEY_LENGTH)} · {record.merchant} · ¥
                {money(record.amount)}
              </Text>
            ))}
            <Button
              mode="contained"
              loading={controller.isSaving}
              disabled={
                needsMappingReview ||
                !records.length ||
                isReading ||
                controller.isSaving ||
                (errors.length > 0 && !shouldSkipErrors)
              }
              onPress={() => void commit()}
            >
              确认导入
            </Button>
          </Section>
        ) : null}
        {message ? (
          <>
            <Text accessibilityLiveRegion="polite">{message}</Text>
            <Button onPress={onReview}>去重复核对</Button>
          </>
        ) : null}
      </Screen>
      {mappingFile ? (
        <StatementMapping
          file={mappingFile}
          onClose={() => setMapping(null)}
          onChange={(next) => {
            setFiles(
              files.map((file) => (file.hash === next.hash ? next : file)),
            );
            setShouldSkipErrors(false);
          }}
        />
      ) : null}
    </>
  );
}
