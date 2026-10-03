import type { Ledger, ReimbursementState } from "@hamster-ledger/core";
import type { SplitMember } from "@hamster-ledger/ledger-react";
import { ChoiceField } from "../ui/ChoiceField";
export interface FinanceFilter {
  accountId: string;
  memberId: string;
  reimbursement: ReimbursementState;
  category: string;
}
export function RecordFilters({
  ledger,
  filter,
  members,
  onChange,
}: {
  ledger: Ledger;
  filter: FinanceFilter;
  members: SplitMember[];
  onChange: (filter: FinanceFilter) => void;
}): React.JSX.Element {
  return (
    <>
      <ChoiceField
        label="关联账户"
        value={filter.accountId}
        onChange={(accountId) => onChange({ ...filter, accountId })}
        options={[
          { value: "", label: "全部账户" },
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
