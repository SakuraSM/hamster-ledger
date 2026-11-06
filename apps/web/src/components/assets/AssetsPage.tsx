import { Button } from "@mantine/core";
import { useState } from "react";
import { useAssetSummary } from "@hamster-ledger/ledger-react";
import {
  type AssetAccount,
  type Ledger,
  type BillRecord,
} from "@hamster-ledger/core";
import { useNetworkClient } from "../../hooks/useNetworkController";
import { localNow } from "../../platform/browser/runtime";
import {
  AccountEditor,
  type AccountSave,
  type AssetBookContext,
} from "./AccountEditor";
import { AccountDetail } from "./AccountDetail";
import { BalanceCalibration } from "./BalanceCalibration";
import { AssetContext } from "./AssetContext";
import { TransferEditor } from "./TransferEditor";
import { AssetOverview } from "./AssetOverview";

const DATE_KEY_LENGTH = 10;
interface AssetsPageProps {
  ledger: Ledger;
  isDemo: boolean;
  bookContext?: AssetBookContext;
  onSave: (input: AccountSave) => Promise<void>;
  onArchive: (input: {
    accountId: string;
    isArchived: boolean;
  }) => Promise<void>;
  onRecord: (record: BillRecord) => void;
  onUnassigned: () => void;
  onLoadExamples: () => Promise<void>;
  onCommit: (ledger: Ledger) => Promise<void>;
  canUndo?: boolean;
  onUndo?: () => void;
}

export function AssetsPage({
  ledger,
  isDemo,
  bookContext,
  onSave,
  onArchive,
  onRecord,
  onUnassigned,
  onLoadExamples,
  onCommit,
  canUndo = false,
  onUndo,
}: AssetsPageProps): React.JSX.Element {
  const [selectedId, setSelectedId] = useState<string | null>(null);
  const [editor, setEditor] = useState<{
    account?: AssetAccount;
    isCalibration?: boolean;
  } | null>(null);
  const [transfer, setTransfer] = useState<{
    sourceId?: string;
    repaymentAccount?: AssetAccount;
  } | null>(null);
  const [search, setSearch] = useState<{
    value: string;
    isHidden: boolean;
  } | null>(null);
  const [visibilityOverride, setVisibilityOverride] = useState<boolean | null>(
    null,
  );
  const [showArchived, setShowArchived] = useState(false);
  const [showTrend, setShowTrend] = useState(false);
  const [recordRequest, setRecordRequest] = useState(0);
  const [traceRequest, setTraceRequest] = useState(0);
  const [focusAccounts, setFocusAccounts] = useState(false);
  const [settingsTarget, setSettingsTarget] = useState<"date" | "rates" | null>(
    null,
  );
  const [actionError, setActionError] = useState("");
  const [isLoadingExamples, setLoadingExamples] = useState(false);
  const [valuationDate, setValuationDate] = useState(
    localNow().slice(0, DATE_KEY_LENGTH),
  );
  const through = valuationDate + " 23:59:59";
  const isHidden =
    visibilityOverride ?? Boolean(ledger.preferences?.hideAmounts);
  const summary = useAssetSummary({
    ledger,
    date: valuationDate,
    client: useNetworkClient(),
  });
  const selected = ledger.accounts.find((account) => account.id === selectedId);
  async function loadExamples(): Promise<void> {
    setLoadingExamples(true);
    try {
      await onLoadExamples();
      setActionError("");
    } catch (cause) {
      setActionError(
        cause instanceof Error ? cause.message : "示例账户载入失败。",
      );
    } finally {
      setLoadingExamples(false);
    }
  }
  function selectAccount(id: string): void {
    setRecordRequest(0);
    setTraceRequest(0);
    setSelectedId(id);
  }
  return (
    <>
      {actionError ? (
        <p className="error-message" role="alert">
          {actionError}
        </p>
      ) : null}
      {canUndo && onUndo ? (
        <Button variant="subtle" className="asset-undo" onClick={onUndo}>
          撤销上一次修改
        </Button>
      ) : null}
      <div className="assets-page asset-layout">
        <div className="asset-main">
          {selected ? (
            <AccountDetail
              account={selected}
              ledger={ledger}
              through={through}
              isHidden={isHidden}
              recordRequest={recordRequest}
              traceRequest={traceRequest}
              onBack={() => setSelectedId(null)}
              onEdit={() => setEditor({ account: selected })}
              onCalibrate={() =>
                setEditor({ account: selected, isCalibration: true })
              }
              onTransfer={() =>
                setTransfer(
                  selected.kind === "liability"
                    ? { repaymentAccount: selected }
                    : { sourceId: selected.id },
                )
              }
              onArchive={onArchive}
              onRecord={onRecord}
            />
          ) : (
            <AssetOverview
              ledger={ledger}
              isDemo={isDemo}
              isHidden={isHidden}
              valuationDate={valuationDate}
              summary={summary}
              search={search?.isHidden === isHidden ? search.value : ""}
              showArchived={showArchived}
              showTrend={showTrend}
              isLoadingExamples={isLoadingExamples}
              focusAccounts={focusAccounts}
              settingsTarget={settingsTarget}
              onAccountsFocused={() => setFocusAccounts(false)}
              onSettingsOpened={() => setSettingsTarget(null)}
              onAdd={() => setEditor({})}
              onSelect={selectAccount}
              onTransfer={() => setTransfer({})}
              onUnassigned={onUnassigned}
              onLoadExamples={() => void loadExamples()}
              onSearch={(value) => setSearch({ value, isHidden })}
              onToggleAmounts={() => {
                setSearch(null);
                setVisibilityOverride(!isHidden);
              }}
              onShowArchived={setShowArchived}
              onShowTrend={setShowTrend}
              onDate={setValuationDate}
            />
          )}
        </div>
        <AssetContext
          totals={summary.totals}
          comparison={summary.comparison}
          date={valuationDate}
          isHidden={isHidden}
          isDetail={Boolean(selected)}
          onTrace={() => {
            if (selected) setTraceRequest((value) => value + 1);
            else setFocusAccounts(true);
          }}
          onSettings={(target) => {
            setSelectedId(null);
            setSettingsTarget(target);
          }}
        />
      </div>
      {editor?.isCalibration && editor.account ? (
        <BalanceCalibration
          account={editor.account}
          bookContext={bookContext}
          ledger={ledger}
          date={valuationDate}
          isHidden={isHidden}
          onSave={onSave}
          onClose={() => setEditor(null)}
          onRecords={() => {
            setEditor(null);
            setRecordRequest((value) => value + 1);
          }}
        />
      ) : editor ? (
        <AccountEditor
          account={editor.account}
          bookContext={bookContext}
          isHidden={isHidden}
          onSave={onSave}
          onClose={() => setEditor(null)}
        />
      ) : null}
      {transfer ? (
        <TransferEditor
          ledger={ledger}
          sourceId={transfer.sourceId}
          repaymentAccount={transfer.repaymentAccount}
          isHidden={isHidden}
          onSave={async (next) => {
            await onCommit(next);
          }}
          onClose={() => setTransfer(null)}
        />
      ) : null}
    </>
  );
}
