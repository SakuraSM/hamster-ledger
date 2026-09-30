import { useEffect, useRef, type ReactNode } from "react";
import { Icons } from "./Icons";

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
  const dialogRef = useRef<HTMLDialogElement>(null);
  useEffect(() => {
    const previous = document.activeElement;
    const dialog = dialogRef.current;
    dialog?.showModal();
    return () => {
      dialog?.close();
      if (previous instanceof HTMLElement) previous.focus();
    };
  }, []);
  return (
    <dialog
      ref={dialogRef}
      className={`dialog ${wide ? "dialog-wide" : ""}`}
      onCancel={onClose}
      aria-labelledby="dialog-title"
    >
      <header className="dialog-header">
        <h2 id="dialog-title">{title}</h2>
        <button className="icon-button" onClick={onClose} aria-label="关闭弹窗">
          <Icons.Close size={23} />
        </button>
      </header>
      {children}
    </dialog>
  );
}
