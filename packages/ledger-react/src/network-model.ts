import type { BookRole, Ledger } from "@hamster-ledger/core";
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
  role?: BookRole;
  revision?: number;
  error: string;
  refresh: () => Promise<void>;
  receive?: (snapshot: NetworkSnapshot) => Promise<void>;
}
