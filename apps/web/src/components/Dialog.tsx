import { useState, useEffect, useId, type ReactNode } from "react";
import { Modal } from "@mantine/core";
const WIDE_DIALOG_WIDTH = 820;
const DEFAULT_DIALOG_WIDTH = 600;
interface DialogProps {
  title: string;
  children: ReactNode;
  onClose: () => void;
  wide?: boolean;
}
export function Dialog({
  title,
  children,
  onClose,
  wide = false,
}: DialogProps): React.JSX.Element {
  const stackId = useId();
  const [isOpened, setIsOpened] = useState(false);
  const [opener] = useState(() => document.activeElement);
  useEffect(() => {
    setIsOpened(true);
  }, []);
  useEffect(
    () => () => {
      // Forms can also unmount their dialog directly after saving or cancelling.
      if (opener instanceof HTMLElement && opener.isConnected)
        opener.focus({ preventScroll: true });
    },
    [opener],
  );
  return (
    <Modal.Stack>
      <Modal
        stackId={stackId}
        opened={isOpened}
        onClose={() => setIsOpened(false)}
        onExitTransitionEnd={onClose}
        title={title}
        size={wide ? WIDE_DIALOG_WIDTH : DEFAULT_DIALOG_WIDTH}
        padding="lg"
        closeButtonProps={{ "aria-label": "关闭弹窗" }}
        classNames={{
          content: "ledger-modal",
          header: "ledger-modal-header",
          title: "ledger-modal-title",
        }}
      >
        {children}
      </Modal>
    </Modal.Stack>
  );
}
