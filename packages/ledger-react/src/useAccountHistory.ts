const MONTH_KEY_LENGTH = 7;
import { useMemo, useState } from "react";
import {
  accountActivity,
  linkedAccountRecords,
  type AccountActivity,
  type AssetAccount,
  type BillRecord,
  type Ledger,
} from "@hamster-ledger/core";

const PAGE_SIZE = 20;
export type AccountHistoryMode = "changes" | "records";
export interface AccountHistoryController {
  month: string;
  mode: AccountHistoryMode;
  months: string[];
  activities: AccountActivity[];
  records: BillRecord[];
  count: number;
  page: number;
  pages: number;
  setMonth: (value: string) => void;
  setMode: (value: AccountHistoryMode) => void;
  setPage: (value: number) => void;
}
export function useAccountHistory(input: {
  ledger: Ledger;
  account: AssetAccount;
  through: string;
}): AccountHistoryController {
  const [month, setMonth] = useState("");
  const [mode, setMode] = useState<AccountHistoryMode>("changes");
  const [requestedPage, setPage] = useState(1);
  const all = useMemo(
    () => ({
      activities: accountActivity(input),
      records: linkedAccountRecords({
        records: input.ledger.records,
        accounts: input.ledger.accounts,
        accountId: input.account.id,
      })
        .filter(
          (record) =>
            !record.isDeleted &&
            record.status !== "duplicate" &&
            record.date <= input.through,
        )
        .sort(
          (left, right) =>
            right.date.localeCompare(left.date) ||
            left.id.localeCompare(right.id),
        ),
    }),
    [input.ledger, input.account, input.through],
  );
  const months = [
    ...new Set([
      ...all.activities.map((row) => row.at.slice(0, MONTH_KEY_LENGTH)),
      ...all.records.map((row) => row.date.slice(0, MONTH_KEY_LENGTH)),
    ]),
  ]
    .sort()
    .reverse();
  const activities = all.activities.filter(
    (row) => !month || row.at.startsWith(month),
  );
  const records = all.records.filter(
    (row) => !month || row.date.startsWith(month),
  );
  const count = mode === "changes" ? activities.length : records.length;
  const pages = Math.max(1, Math.ceil(count / PAGE_SIZE));
  const page = Math.min(requestedPage, pages);
  const offset = (page - 1) * PAGE_SIZE;
  return {
    month,
    mode,
    months,
    count,
    page,
    pages,
    activities: activities.slice(offset, offset + PAGE_SIZE),
    records: records.slice(offset, offset + PAGE_SIZE),
    setPage,
    setMonth(value) {
      setMonth(value);
      setPage(1);
    },
    setMode(value) {
      setMode(value);
      setPage(1);
    },
  };
}
