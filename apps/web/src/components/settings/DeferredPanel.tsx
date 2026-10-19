import { useEffect, useState, type ReactNode } from "react";
/** Mount on first visit, then retain unsaved form state while switching tools. */
export function DeferredPanel({
  active,
  children,
}: {
  active: boolean;
  children: ReactNode;
}): React.JSX.Element | null {
  const [hasOpened, setHasOpened] = useState(active);
  useEffect(() => {
    if (active) setHasOpened(true);
  }, [active]);
  return active || hasOpened ? <div hidden={!active}>{children}</div> : null;
}
