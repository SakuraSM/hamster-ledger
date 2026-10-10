import type { ReimbursementState } from "@hamster-ledger/core";
import type { SplitMember } from "@hamster-ledger/ledger-react";
import { Choice } from "../../ui/Choice";
export function RecordFilters({
  memberId,
  reimbursement,
  members,
  onMember,
  onReimbursement,
}: {
  memberId: string;
  reimbursement: ReimbursementState;
  members: SplitMember[];
  onMember: (value: string) => void;
  onReimbursement: (value: ReimbursementState) => void;
}): React.JSX.Element {
  return (
    <>
      <Choice aria-label="记账或分摊成员" value={memberId} onChange={onMember}>
        <option value="">全部成员</option>
        {members.map((member) => (
          <option key={member.id} value={member.id}>
            {member.username}
          </option>
        ))}
      </Choice>
      <Choice
        aria-label="报销状态"
        value={reimbursement}
        onChange={(value) => onReimbursement(value as ReimbursementState)}
      >
        <option value="">全部报销状态</option>
        <option value="pending">待报销</option>
        <option value="partial">部分回款</option>
        <option value="settled">已结清</option>
        <option value="none">非报销支出</option>
      </Choice>
    </>
  );
}
