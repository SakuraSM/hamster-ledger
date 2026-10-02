import type {
  CloudBook,
  CloudSnapshot,
  CloudUser,
} from "../platform/browser/cloud";
export interface CloudController {
  user: CloudUser | null;
  books: CloudBook[];
  isBusy: boolean;
  message: string;
  error: string;
  preview: CloudSnapshot | null;
  isLinked: boolean;
  authenticate: (input: {
    username: string;
    password: string;
    isRegister: boolean;
  }) => Promise<void>;
  logout: () => Promise<void>;
  upload: () => Promise<void>;
  sync: () => Promise<void>;
  inspect: (id: string) => Promise<void>;
  restore: () => Promise<void>;
  dismissPreview: () => void;
  disconnect: () => Promise<void>;
}
