import { DATE_KEY_LENGTH } from "../constants";
import { useEffect, useRef, useState } from "react";
import { Alert, StyleSheet } from "react-native";
import { Button, Text, useTheme } from "react-native-paper";
import {
  accountActiveAt,
  assetTrendStart,
  type AssetAccount,
  type BillRecord,
} from "@hamster-ledger/core";
import {
  useAssetSummary,
  type LedgerController,
  type AccountHistoryMode,
} from "@hamster-ledger/ledger-react";
import { useNativeAccount } from "../auth/NativeAccount";
import { FormSheet } from "../ui/FormSheet";
import { Screen, ErrorMessage } from "../ui/Screen";
import { AccountEditor } from "./AccountEditor";
import { BalanceCalibration } from "./BalanceCalibration";
import { AssetAccountDetail } from "./AssetAccountDetail";
import { AssetAccountList } from "./AssetAccountList";
import { AssetSummary } from "./AssetSummary";
import { AssetUnassigned } from "./AssetUnassigned";
import { unassignedAssetRecords } from "./asset-actions";
import {
  promptAssetArchive,
  commitAssetArchive,
  type AssetArchiveRequest,
} from "./asset-archive";
import { AssetTransfer } from "./AssetTransfer";
import { NetWorthReport } from "./NetWorthReport";
import { AssetValuationDialog } from "./AssetValuationDialog";
import { localNow } from "../platform/runtime";

interface AssetsScreenProps {
  controller: LedgerController;
  onRecord: (record: BillRecord) => void;
}
export function AssetsScreen({
  controller,
  onRecord,
}: AssetsScreenProps): React.JSX.Element {
  const theme = useTheme();
  const currentController = useRef(controller);
  currentController.current = controller;
  const isMounted = useRef(false);
  useEffect(() => {
    isMounted.current = true;
    return () => {
      isMounted.current = false;
    };
  }, []);
  const [editor, setEditor] = useState<AssetAccount | "new" | null>(null);
  const [selected, setSelected] = useState<string | null>(null);
  const [initialHistoryMode, setInitialHistoryMode] =
    useState<AccountHistoryMode>("changes");
  const [calibration, setCalibration] = useState<string | null>(null);
  const [transfer, setTransfer] = useState<AssetAccount | "new" | null>(null);
  const [transferOrigin, setTransferOrigin] = useState<string | null>(null);
  const [isValuationOpen, setValuationOpen] = useState(false);
  const [valuationOrigin, setValuationOrigin] = useState<string | null>(null);
  const [isTrendOpen, setTrendOpen] = useState(false);
  const [isUnassignedOpen, setUnassignedOpen] = useState(false);
  const [error, setError] = useState("");
  const [valuationDate, setValuationDate] = useState(
    localNow().slice(0, DATE_KEY_LENGTH),
  );
  const ledger = controller.ledger;
  const [isAmountHidden, setAmountHidden] = useState(
    Boolean(ledger.preferences?.hideAmounts),
  );
  useEffect(() => {
    setAmountHidden(Boolean(ledger.preferences?.hideAmounts));
  }, [controller.mode, ledger.preferences?.hideAmounts]);
  const currencies = ledger.accounts
    .filter((account) => accountActiveAt(account, valuationDate + " 23:59:59"))
    .map((account) => account.currency ?? "CNY");
  const { totals, comparison, rates } = useAssetSummary({
    ledger,
    date: valuationDate,
    client: useNativeAccount().client,
  });
  const trendStart = assetTrendStart({ ledger, end: valuationDate });
  const through = valuationDate + " 23:59:59";
  const account = ledger.accounts.find((item) => item.id === selected);
  const calibrationAccount = ledger.accounts.find(
    (item) => item.id === calibration,
  );
  const unassigned = unassignedAssetRecords(ledger);
  async function archive(request: AssetArchiveRequest): Promise<void> {
    try {
      await commitAssetArchive({
        controller: currentController.current,
        request,
        isMounted: isMounted.current,
        at: localNow(),
      });
      if (isMounted.current) {
        setSelected(null);
        setError("");
      }
    } catch (cause) {
      const message = cause instanceof Error ? cause.message : "归档失败";
      if (isMounted.current) setError(message);
      Alert.alert("账户操作失败", message);
    }
  }
  function startTransfer(item?: AssetAccount): void {
    setSelected(null);
    setTransferOrigin(item?.id ?? null);
    setTransfer(item ?? "new");
  }
  function closeTransfer(): void {
    setTransfer(null);
    if (transferOrigin) setSelected(transferOrigin);
    setTransferOrigin(null);
  }
  return (
    <>
      <Screen>
        <AssetSummary
          valuationDate={valuationDate}
          totals={totals}
          comparison={comparison}
          isAmountHidden={isAmountHidden}
          onShowValuation={() => {
            setValuationOrigin(null);
            setValuationOpen(true);
          }}
          onToggleAmounts={() => setAmountHidden(!isAmountHidden)}
          onAdd={() => setEditor("new")}
        />
        <ErrorMessage message={error} />
        <AssetAccountList
          ledger={ledger}
          through={through}
          changes={comparison.accountChanges}
          isAmountHidden={isAmountHidden}
          onSelect={(id) => {
            setInitialHistoryMode("changes");
            setSelected(id);
          }}
        />
        {unassigned.length ? (
          <Button
            icon="link-variant"
            mode="text"
            contentStyle={styles.touch}
            onPress={() => setUnassignedOpen(true)}
          >
            {unassigned.length} 条已确认账单尚未关联账户
          </Button>
        ) : null}
        <Button
          mode="contained"
          icon="swap-horizontal"
          contentStyle={styles.touch}
          onPress={() => startTransfer()}
        >
          账户间转账
        </Button>
        <Button contentStyle={styles.touch} onPress={() => setTrendOpen(true)}>
          查看净资产趋势
        </Button>
        <Text
          variant="bodySmall"
          style={{ color: theme.colors.onSurfaceVariant }}
        >
          余额由你维护基准，之后的已确认流水自动累计。账户间转账不计入收支。
        </Text>
      </Screen>
      {account ? (
        <AssetAccountDetail
          account={account}
          ledger={ledger}
          through={through}
          rate={rates.rates.find(
            (item) => item.currency === (account.currency ?? "CNY"),
          )}
          isSaving={controller.isSaving}
          initialHistoryMode={initialHistoryMode}
          isAmountHidden={isAmountHidden}
          onReveal={() => setAmountHidden(false)}
          onClose={() => setSelected(null)}
          onEdit={() => {
            setSelected(null);
            setEditor(account);
          }}
          onCalibrate={() => {
            setSelected(null);
            setCalibration(account.id);
          }}
          onTransfer={() => startTransfer(account)}
          onManageRates={() => {
            setSelected(null);
            setValuationOrigin(account.id);
            setValuationOpen(true);
          }}
          onArchive={() =>
            promptAssetArchive({
              controller,
              account,
              show: Alert.alert,
              onConfirm: (request) => void archive(request),
            })
          }
          onRecord={(record) => {
            setSelected(null);
            onRecord(record);
          }}
        />
      ) : null}
      {editor ? (
        <AccountEditor
          account={editor === "new" ? undefined : editor}
          controller={controller}
          onClose={() => {
            if (editor !== "new") setSelected(editor.id);
            setEditor(null);
          }}
        />
      ) : null}
      {calibrationAccount ? (
        <BalanceCalibration
          controller={controller}
          account={calibrationAccount}
          date={valuationDate}
          onClose={() => {
            setCalibration(null);
            setInitialHistoryMode("changes");
            setSelected(calibrationAccount.id);
          }}
          onFindRecords={() => {
            setCalibration(null);
            setInitialHistoryMode("records");
            setSelected(calibrationAccount.id);
          }}
        />
      ) : null}
      {transfer ? (
        <AssetTransfer
          ledger={ledger}
          account={transfer === "new" ? undefined : transfer}
          isAmountHidden={isAmountHidden}
          onSave={async (next) => {
            await controller.commit(next);
          }}
          onClose={closeTransfer}
        />
      ) : null}
      {isValuationOpen ? (
        <AssetValuationDialog
          value={valuationDate}
          currencies={currencies}
          rates={rates}
          onChange={setValuationDate}
          onClose={() => {
            setValuationOpen(false);
            if (valuationOrigin) setSelected(valuationOrigin);
            setValuationOrigin(null);
          }}
        />
      ) : null}
      {isTrendOpen ? (
        <FormSheet title="净资产趋势" onClose={() => setTrendOpen(false)}>
          {isAmountHidden ? (
            <Button
              contentStyle={styles.touch}
              onPress={() => setAmountHidden(false)}
            >
              显示资产金额后查看趋势
            </Button>
          ) : ledger.accounts.length > 0 && trendStart <= valuationDate ? (
            <NetWorthReport
              ledger={ledger}
              start={trendStart}
              end={valuationDate}
            />
          ) : (
            <Text>添加账户并设置余额后，即可查看净资产趋势。</Text>
          )}
        </FormSheet>
      ) : null}
      {isUnassignedOpen ? (
        <AssetUnassigned
          records={unassigned}
          isAmountHidden={isAmountHidden}
          onReveal={() => setAmountHidden(false)}
          onClose={() => setUnassignedOpen(false)}
          onRecord={(record) => {
            setUnassignedOpen(false);
            onRecord(record);
          }}
        />
      ) : null}
    </>
  );
}
const styles = StyleSheet.create({ touch: { minHeight: 48 } });
