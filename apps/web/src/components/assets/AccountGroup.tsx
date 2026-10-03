import { UnstyledButton } from "@mantine/core";
import { formatCurrency, type AccountBalance } from "@hamster-ledger/core";
import { Icons } from "../Icons";
interface AccountGroupProps {
  title: string;
  accounts: AccountBalance[];
  onSelect: (id: string) => void;
}
export function AccountGroup({
  title,
  accounts,
  onSelect,
}: AccountGroupProps): React.JSX.Element {
  if (!accounts.length)
    return (
      <section className="asset-account-group">
        <h2>{title}</h2>
        <p className="muted">还没有{title}，可添加银行卡、现金或贷款等账户。</p>
      </section>
    );
  return (
    <section className="asset-account-group">
      <div className="section-heading">
        <h2>
          {title}
          <small> {accounts.length} 个</small>
        </h2>
        <span>当前余额</span>
      </div>
      <div className="asset-account-list">
        {accounts.map(({ account, balance, movementCount }) => {
          const Icon =
            account.kind === "liability"
              ? Icons.Credit
              : account.type === "银行卡"
                ? Icons.Bank
                : Icons.Wallet;
          return (
            <UnstyledButton
              type="submit"
              className="asset-account-row"
              key={account.id}
              onClick={() => onSelect(account.id)}
            >
              <span className="account-symbol">
                <Icon size={24} weight="duotone" />
              </span>
              <span className="account-name">
                <strong>{account.name}</strong>
                <small>
                  {account.type} ·{" "}
                  {account.isArchived
                    ? "已归档"
                    : `${movementCount} 笔基准后变动`}
                </small>
              </span>
              <span className="account-row-balance">
                {account.kind === "liability" && balance < 0 ? (
                  <small>预存</small>
                ) : null}
                {formatCurrency({
                  minor:
                    account.kind === "liability" ? Math.abs(balance) : balance,
                  currency: account.currency ?? "CNY",
                })}
              </span>
              <Icons.Caret size={18} />
            </UnstyledButton>
          );
        })}
      </div>
    </section>
  );
}
