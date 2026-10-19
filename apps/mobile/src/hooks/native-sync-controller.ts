import type { CloudBook, CloudSnapshot } from "../platform/cloud-client";
export interface SyncLink {
  id: string;
  revision: number;
  fingerprint: string;
}
export interface NativeSyncController {
  link: SyncLink | null;
  books: CloudBook[];
  preview: CloudSnapshot | null;
  isBusy: boolean;
  error: string;
  message: string;
  upload: () => Promise<void>;
  sync: () => Promise<void>;
  refresh: () => Promise<void>;
  inspect: (id: string) => Promise<void>;
  restore: () => Promise<void>;
  disconnect: () => Promise<void>;
  dismissPreview: () => void;
}
