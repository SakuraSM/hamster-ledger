import {
  KINDS,
  UNASSIGNED_ACCOUNT_FILTER,
  type BillRecord,
  type Kind,
  type Ledger,
  type ReimbursementState,
} from "@hamster-ledger/core";
import type { SplitMember } from "@hamster-ledger/ledger-react";
import { ChoiceField } from "../ui/ChoiceField";
import { DateField } from "../ui/DateField";
export interface FinanceFilter {
  accountId: string;
  memberId: string;
  reimbursement: ReimbursementState;
  category: string;
  startDate: string;
  endDate: string;
  kind: Kind | "";
  status: BillRecord["status"] | "";
}
export const EMPTY_FILTER: FinanceFilter = {
  accountId: "",
  memberId: "",
  reimbursement: "",
  category: "",
  startDate: "",
  endDate: "",
  kind: "",
  status: "",
};
export function RecordFilters({
  ledger,
  filter,
  members,
  onChange,
  isTrash = false,
}: {
  ledger: Ledger;
  filter: FinanceFilter;
  members: SplitMember[];
  onChange: (filter: FinanceFilter) => void;
  isTrash?: boolean;
}): React.JSX.Element {
  return (
    <>
      <DateField
        label="开始日期"
        value={filter.startDate}
        onChange={(startDate) => onChange({ ...filter, startDate })}
      />
      <DateField
        label="结束日期"
        value={filter.endDate}
        onChange={(endDate) => onChange({ ...filter, endDate })}
      />
      <ChoiceField
        label="收支类型"
        value={filter.kind}
        onChange={(kind) => onChange({ ...filter, kind: kind as Kind | "" })}
        options={[
          { value: "", label: "全部类型" },
          ...KINDS.map((kind) => ({ value: kind, label: kind })),
        ]}
      />
      <ChoiceField
        label="处理状态"
        value={filter.status}
        onChange={(status) =>
          onChange({ ...filter, status: status as BillRecord["status"] | "" })
        }
        options={[
          { value: "", label: isTrash ? "全部状态" : "有效与待确认" },
          { value: "confirmed", label: "已入账" },
          { value: "pending", label: "待确认" },
          { value: "duplicate", label: "重复记录" },
        ]}
      />
      <ChoiceField
        label="关联账户"
        value={filter.accountId}
        onChange={(accountId) => onChange({ ...filter, accountId })}
        options={[
          { value: "", label: "全部账户" },
          { value: UNASSIGNED_ACCOUNT_FILTER, label: "未关联账户" },
          ...ledger.accounts.map((item) => ({
            value: item.id,
            label: item.name,
          })),
        ]}
      />
      <ChoiceField
        label="分类"
        value={filter.category}
        onChange={(category) => onChange({ ...filter, category })}
        options={[
          { value: "", label: "全部分类" },
          ...[...new Set(ledger.records.map((item) => item.category))].map(
            (name) => ({ value: name, label: name }),
          ),
        ]}
      />
      <ChoiceField
        label="记账或分摊成员"
        value={filter.memberId}
        onChange={(memberId) => onChange({ ...filter, memberId })}
        options={[
          { value: "", label: "全部成员" },
          ...members.map((item) => ({ value: item.id, label: item.username })),
        ]}
      />
      <ChoiceField
        label="报销状态"
        value={filter.reimbursement}
        onChange={(reimbursement) =>
          onChange({
            ...filter,
            reimbursement: reimbursement as ReimbursementState,
          })
        }
        options={[
          { value: "", label: "全部报销状态" },
          { value: "pending", label: "待报销" },
          { value: "partial", label: "部分回款" },
          { value: "settled", label: "已结清" },
          { value: "none", label: "非报销支出" },
        ]}
      />
    </>
  );
}
