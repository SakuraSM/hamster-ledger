import { useState } from "react";
import { accountIconLabels, type AccountIconKey } from "@hamster-ledger/core";
import { accountGlyphs } from "./account-glyphs";
export function AccountIconPicker({
  value,
  onChange,
}: {
  value?: AccountIconKey;
  onChange: (key: AccountIconKey | undefined) => void;
}) {
  const [query, search] = useState("");
  const options = (Object.keys(accountIconLabels) as AccountIconKey[]).filter(
    (k) => accountIconLabels[k].includes(query.trim()),
  );
  return (
    <details className="atlas-icon-picker">
      <summary>
        账户图标 · {value ? accountIconLabels[value] : "跟随账户类型"}
      </summary>
      <label>
        搜索图标
        <input value={query} onChange={(e) => search(e.currentTarget.value)} />
      </label>
      <div>
        <button
          type="button"
          aria-pressed={!value}
          onClick={() => onChange(undefined)}
        >
          自动
        </button>
        {options.map((k) => {
          const Icon = accountGlyphs[k];
          return (
            <button
              type="button"
              key={k}
              aria-pressed={value === k}
              onClick={() => onChange(k)}
            >
              <Icon size={20} />
              {accountIconLabels[k]}
            </button>
          );
        })}
      </div>
      {!options.length && <p>没有匹配图标</p>}
    </details>
  );
}
