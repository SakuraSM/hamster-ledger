import { nativeStore } from "../platform/storage";
import { DATE_KEY_LENGTH } from "../constants";
const IMPORT_PREVIEW_LIMIT = 5;
const ERROR_PREVIEW_LIMIT = 10;
import { useMemo, useState } from "react";
import {
  Button,
  Card,
  Checkbox,
  Text,
  ProgressBar,
  useTheme,
} from "react-native-paper";
import { View } from "react-native";
import { ReceiptAction } from "./ReceiptAction";
import type { LedgerController } from "@hamster-ledger/ledger-react";
import { planImport, money } from "@hamster-ledger/core";
import {
  parseStatement,
  reuseMapping,
  importErrorReport,
  mappingNeedsReview,
  type StatementFile,
} from "@hamster-ledger/importers";
import {
  pickStatements,
  readStatement,
  shareImportErrors,
} from "../platform/files";
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
  const theme = useTheme();
  const isAmountHidden = Boolean(controller.ledger.preferences?.hideAmounts);
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
        const file = await reuseMapping(
          nativeStore,
          await readStatement(asset),
        );
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
  const mappingPreview = parsed.find((item) => item.file.hash === mapping);
  const personalBook = controller.books.find(
    (book) => book.id === "personal" && !book.isArchived,
  );
  if (controller.mode === "demo")
    return (
      <Screen>
        <Text variant="headlineSmall" accessibilityRole="header">
          账单放进来
        </Text>
        <Text>
          {personalBook
            ? "真实账单会保存在「我的账本」，与示例数据分开。"
            : "当前身份无法使用个人账本，请在账本管理中切换到可用账本后再导入。"}
        </Text>
        <Button
          mode="contained"
          disabled={!personalBook}
          onPress={() => {
            if (personalBook) controller.switchMode("personal");
          }}
        >
          使用我的账本导入
        </Button>
      </Screen>
    );
  return (
    <>
      <Screen>
        <Text variant="headlineSmall" accessibilityRole="header">
          账单放进来
        </Text>
        <Text>
          支持支付宝、微信与银行 CSV / Excel。单文件最多 10 MB、15,000
          行，内容在本机处理。
        </Text>
        <Text>
          导入到：
          {controller.books.find((book) => book.id === controller.mode)?.name}
        </Text>
        <View
          style={{
            borderWidth: 1,
            borderStyle: "dashed",
            borderColor: theme.colors.outlineVariant,
            borderRadius: 16,
            padding: 24,
            alignItems: "center",
            gap: 8,
          }}
        >
          <Text variant="titleLarge">选择 CSV / Excel</Text>
          <Text>UTF-8 / GB18030 · 单文件 10 MB 内</Text>
          <Button
            mode="outlined"
            icon="file-upload-outline"
            contentStyle={{ minHeight: 48 }}
            loading={isReading}
            disabled={isReading || controller.isSaving}
            onPress={() => void choose()}
          >
            选择账单文件
          </Button>
        </View>
        {isReading ? <ProgressBar indeterminate /> : null}
        <ErrorMessage
          message={
            isAmountHidden && error
              ? "读取或导入失败，请检查文件后重试。"
              : error
          }
        />
        {parsed.map((item) => (
          <Card key={item.file.hash} mode="outlined">
            <Card.Content>
              <Text variant="titleMedium">
                {isAmountHidden ? "账单文件" : item.file.name}
              </Text>
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
            <Button
              onPress={() =>
                void shareImportErrors(importErrorReport(parsed)).catch(
                  (cause) =>
                    setError(
                      cause instanceof Error
                        ? cause.message
                        : "错误行导出失败。",
                    ),
                )
              }
            >
              导出错误行与原始依据
            </Button>
            <Text>
              {isAmountHidden
                ? "金额与错误行内容已隐藏。"
                : errors.slice(0, ERROR_PREVIEW_LIMIT).join("\n")}
            </Text>
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
                {isAmountHidden
                  ? `${record.date.slice(0, DATE_KEY_LENGTH)} · 金额已隐藏`
                  : `${record.date.slice(0, DATE_KEY_LENGTH)} · ${record.merchant} · ¥${money(record.amount)}`}
              </Text>
            ))}
            <ReceiptAction
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
            </ReceiptAction>
          </Section>
        ) : null}
        {message ? (
          <>
            <Text accessibilityLiveRegion="polite">{message}</Text>
            <Button onPress={onReview}>去重复核对</Button>
          </>
        ) : null}
      </Screen>
      {mappingPreview ? (
        <StatementMapping
          file={mappingPreview.file}
          preview={mappingPreview}
          isAmountHidden={isAmountHidden}
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
