import type { BookRole, Ledger, LedgerMode } from "@hamster-ledger/core";
export interface NetworkBook {
  id: string;
  name: string;
  revision: number;
  updatedAt: string;
  role: BookRole;
}
export interface NetworkSnapshot extends NetworkBook {
  ledger: Ledger;
  operationId?: string;
}
export interface NetworkClient {
  request<Result>(
    path: string,
    options?: { method?: string; body?: unknown },
  ): Promise<Result>;
}
export interface NetworkState {
  isConnected: boolean;
  isOnline: boolean;
  isIdentityBlocked?: boolean;
  role?: BookRole;
  revision?: number;
  error: string;
  refresh: () => Promise<void>;
  receive?: (snapshot: NetworkSnapshot) => Promise<void>;
  revokeCache?: () => Promise<void>;
  prepareCache?: (input: {
    mode: LedgerMode;
    snapshot: NetworkSnapshot;
  }) => Promise<void>;
  contextToken?: object;
  authorizationToken?: object;
}

export interface ScopedNetworkSnapshot {
  key: string;
  version: number;
  snapshot: NetworkSnapshot;
}
export interface ScopedNetworkCache {
  key: string;
  version: number;
  entry: import("@hamster-ledger/core").NetworkCacheEntry;
}
