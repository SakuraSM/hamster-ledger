import { useMemo } from "react";
import {
  useNetworkLedger,
  type LedgerController,
  type NetworkClient,
} from "@hamster-ledger/ledger-react";
import { useAuth } from "../auth/auth-context";
import { cloudRequest } from "../platform/browser/cloud-request";
import { ledgerRepository } from "../platform/browser/storage";
import { newEntityId } from "../platform/browser/runtime";
export function useNetworkClient(): NetworkClient {
  const auth = useAuth();
  return useMemo(
    () => ({
      request: <Result>(
        path: string,
        options: { method?: string; body?: unknown } = {},
      ): Promise<Result> =>
        cloudRequest<Result>(path, {
          method: options.method,
          body:
            options.body === undefined
              ? undefined
              : JSON.stringify(options.body),
          expectedUserId: auth.user?.id,
        }),
    }),
    [auth.user?.id],
  );
}
export function useNetworkController(
  local: LedgerController,
): LedgerController {
  const auth = useAuth();
  const client = useNetworkClient();
  return useNetworkLedger({
    local,
    client,
    userId: auth.user?.id ?? null,
    server: location.origin,
    repository: ledgerRepository,
    newId: newEntityId,
  });
}
