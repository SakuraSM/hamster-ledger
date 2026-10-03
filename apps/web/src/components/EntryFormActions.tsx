import { Button } from "@mantine/core";
export function EntryFormActions({
  error,
  hasConflict,
  onReload,
  onClose,
  busy,
}: {
  error: string;
  hasConflict: boolean;
  onReload?: () => void;
  onClose: () => void;
  busy: boolean;
}): React.JSX.Element {
  return (
    <>
      {error ? (
        <p role="alert" className="error-message">
          {error}
        </p>
      ) : null}
      {hasConflict && onReload ? (
        <p className="notice warning">
          加载最新账单会替换当前草稿。
          <Button
            variant="subtle"
            type="button"
            className="text-button"
            onClick={onReload}
          >
            加载最新账单
          </Button>
        </p>
      ) : null}
      <div className="dialog-actions">
        <Button
          variant="outline"
          type="button"
          className="secondary-button"
          onClick={onClose}
        >
          取消
        </Button>
        <Button
          variant="filled"
          type="submit"
          className="primary-button"
          loading={busy}
        >
          {busy ? "保存中…" : "保存账单"}
        </Button>
      </div>
    </>
  );
}
