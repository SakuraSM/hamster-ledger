import { useState } from "react";
import type { LedgerController } from "@hamster-ledger/ledger-react";
import { AiPanel } from "./ai/AiPanel";
import { InboxPage } from "./InboxPage";

export function InboxWorkspace({
  controller,
  month,
  onMonth,
  onReview,
  onImport,
  onLater,
}: {
  controller: LedgerController;
  month: string;
  onMonth: (month: string) => void;
  onReview: () => void;
  onImport: () => void;
  onLater: () => void;
}): React.JSX.Element {
  const [isAiOpen, setAiOpen] = useState(false);
  if (isAiOpen)
    return (
      <section aria-label="AI 草稿">
        <button
          type="button"
          className="text-button"
          onClick={() => setAiOpen(false)}
        >
          返回待处理
        </button>
        <AiPanel controller={controller} onMonth={onMonth} />
      </section>
    );
  return (
    <InboxPage
      ledger={controller.ledger}
      month={month}
      onReview={onReview}
      onAi={() => setAiOpen(true)}
      onImport={onImport}
      onLater={onLater}
    />
  );
}
