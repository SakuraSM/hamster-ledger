import { useEffect, type Dispatch, type SetStateAction } from "react";
import {
  cloud,
  type CloudBook,
  type CloudUser,
} from "../platform/browser/cloud";
const RETRY_INTERVAL_MS = 15000;
interface Input {
  onUser: Dispatch<SetStateAction<CloudUser | null>>;
  onBooks: (books: CloudBook[]) => void;
  onError: (message: string) => void;
}
export function useCloudBootstrap({ onUser, onBooks, onError }: Input): void {
  useEffect(() => {
    let cancelled = false;
    let isFetching = false;
    const refresh = (): void => {
      if (isFetching || document.visibilityState !== "visible") return;
      isFetching = true;
      void cloud
        .me()
        .then(async (result) => {
          if (cancelled) return;
          onUser((current) =>
            current?.id === result.user?.id &&
            current?.username === result.user?.username
              ? current
              : result.user,
          );
          if (result.user) {
            const resultBooks = await cloud.books();
            if (!cancelled) onBooks(resultBooks.books);
          }
          if (!cancelled) onError("");
        })
        .catch((cause) => {
          if (!cancelled)
            onError(
              cause instanceof Error ? cause.message : "无法连接同步服务。",
            );
        })
        .finally(() => {
          isFetching = false;
        });
    };
    refresh();
    window.addEventListener("online", refresh);
    const timer = setInterval(refresh, RETRY_INTERVAL_MS);
    return () => {
      cancelled = true;
      clearInterval(timer);
      window.removeEventListener("online", refresh);
    };
  }, [onUser, onBooks, onError]);
}
