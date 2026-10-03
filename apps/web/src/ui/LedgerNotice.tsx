import { Affix, Button, Notification, Transition } from "@mantine/core";
import { Icons } from "../components/Icons";
interface LedgerNoticeProps {
  message: string;
  canUndo: boolean;
  onUndo: () => void;
  onDismiss: () => void;
}
export function LedgerNotice({
  message,
  canUndo,
  onUndo,
  onDismiss,
}: LedgerNoticeProps): React.JSX.Element {
  return (
    <Affix
      position={{ bottom: 20, right: 20 }}
      zIndex={190}
      style={{ maxWidth: "calc(100vw - 40px)" }}
    >
      <Transition
        mounted={Boolean(message)}
        transition="slide-up"
        duration={160}
      >
        {(style) => (
          <Notification
            style={style}
            title="账本已更新"
            icon={<Icons.Check size={20} />}
            onClose={onDismiss}
            closeButtonProps={{ "aria-label": "关闭提示" }}
          >
            <div role="status">
              {message}
              {canUndo ? (
                <Button
                  variant="subtle"
                  size="compact-sm"
                  ml="xs"
                  onClick={onUndo}
                >
                  撤销
                </Button>
              ) : null}
            </div>
          </Notification>
        )}
      </Transition>
    </Affix>
  );
}
