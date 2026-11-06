import { Button } from "@mantine/core";
import { Dialog } from "../Dialog";

interface PlanningActionConfirmProps {
  title: string;
  description: string;
  confirmLabel: string;
  isBusy: boolean;
  onConfirm: () => Promise<void>;
  onClose: () => void;
}

export function PlanningActionConfirm({
  title,
  description,
  confirmLabel,
  isBusy,
  onConfirm,
  onClose,
}: PlanningActionConfirmProps): React.JSX.Element {
  return (
    <Dialog title={title} onClose={onClose}>
      <p>{description}</p>
      <div className="dialog-actions">
        <Button variant="outline" disabled={isBusy} onClick={onClose}>
          取消
        </Button>
        <Button
          className="primary-button"
          loading={isBusy}
          onClick={() => void onConfirm()}
        >
          {confirmLabel}
        </Button>
      </div>
    </Dialog>
  );
}
