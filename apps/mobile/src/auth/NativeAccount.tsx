import {
  createContext,
  useContext,
  useEffect,
  useRef,
  useState,
  type ReactNode,
} from "react";
import * as SecureStore from "expo-secure-store";
import { nativeStore } from "../platform/storage";
import {
  createCloudClient,
  normalizeServer,
  parseCredentials,
  type AuthPolicy,
  type Credentials,
  type CloudClient,
  type AuthReceipt,
} from "../platform/cloud-client";
const SESSION_KEY = "hamster-native-session-v1";
const SERVER_KEY = "hamster.native.server.v1";
const LOCAL_KEY = "hamster.native.local-choice.v1";
interface AccountState {
  server: string;
  credentials: Credentials | null;
  policy: AuthPolicy | null;
  isLoading: boolean;
  needsEntry: boolean;
  error: string;
  client: CloudClient;
  connect: (server: string) => Promise<void>;
  authenticate: (input: {
    username: string;
    password: string;
    remember: boolean;
    isRegister: boolean;
  }) => Promise<void>;
  changePassword: (current: string, next: string) => Promise<void>;
  logout: () => Promise<void>;
  continueLocal: () => Promise<void>;
  refresh: () => Promise<void>;
}
const AccountContext = createContext<AccountState | null>(null);
export function NativeAccountProvider({
  children,
}: {
  children: ReactNode;
}): React.JSX.Element {
  const [server, setServer] = useState("");
  const [credentials, setCredentials] = useState<Credentials | null>(null);
  const [policy, setPolicy] = useState<AuthPolicy | null>(null);
  const [isLoading, setLoading] = useState(true);
  const [needsEntry, setNeedsEntry] = useState(false);
  const [error, setError] = useState("");
  const current = useRef<Credentials | null>(null);
  const currentServer = useRef("");
  async function invalidate(): Promise<void> {
    await SecureStore.deleteItemAsync(SESSION_KEY);
    current.current = null;
    setCredentials(null);
  }
  function clientFor(origin: string): CloudClient {
    return createCloudClient({
      origin,
      getCredentials: () =>
        currentServer.current === origin ? current.current : null,
      invalidate,
    });
  }
  async function accept(receipt: AuthReceipt, origin: string): Promise<void> {
    const next = parseCredentials(receipt, current.current?.accessToken);
    if (next.session.remember)
      await SecureStore.setItemAsync(
        SESSION_KEY,
        JSON.stringify({ origin, credentials: next }),
        {
          keychainAccessible: SecureStore.WHEN_UNLOCKED_THIS_DEVICE_ONLY,
        },
      );
    else await SecureStore.deleteItemAsync(SESSION_KEY);
    current.current = next;
    setCredentials(next);
    setNeedsEntry(false);
    setError("");
    if (receipt.policy) setPolicy(receipt.policy);
  }
  useEffect(() => {
    let active = true;
    void (async () => {
      try {
        const origin = await nativeStore.getItem(SERVER_KEY);
        const local = await nativeStore.getItem(LOCAL_KEY);
        const saved = await SecureStore.getItemAsync(SESSION_KEY);
        if (!active) return;
        setNeedsEntry(!local);
        if (!origin) return;
        const validated = normalizeServer(origin, __DEV__);
        currentServer.current = validated;
        setServer(validated);
        if (saved) {
          const parsed = JSON.parse(saved) as {
            origin: string;
            credentials: Credentials;
          };
          if (
            parsed.origin === validated &&
            parsed.credentials.session.expiresAt > Date.now()
          ) {
            const next = parseCredentials(parsed.credentials);
            current.current = next;
            setCredentials(next);
            setNeedsEntry(false);
          } else await invalidate();
        }
        const receipt = await clientFor(validated).me();
        if (!active) return;
        if (receipt.policy) setPolicy(receipt.policy);
        if (receipt.user) await accept(receipt, validated);
        else await invalidate();
      } catch (cause) {
        if (active)
          setError(
            cause instanceof Error ? cause.message : "读取账号设置失败。",
          );
      } finally {
        if (active) setLoading(false);
      }
    })();
    return () => {
      active = false;
    };
  }, []);
  async function connect(value: string): Promise<void> {
    const origin = normalizeServer(value, __DEV__);
    if (currentServer.current && currentServer.current !== origin)
      await invalidate();
    const receipt = await clientFor(origin).me();
    await nativeStore.setItem(SERVER_KEY, origin);
    currentServer.current = origin;
    setServer(origin);
    setPolicy(receipt.policy ?? null);
    setError("");
  }
  async function continueLocal(): Promise<void> {
    await nativeStore.setItem(LOCAL_KEY, "1");
    setNeedsEntry(false);
  }
  async function authenticate(input: {
    username: string;
    password: string;
    remember: boolean;
    isRegister: boolean;
  }): Promise<void> {
    if (!currentServer.current) throw new Error("请先连接你的记账服务。");
    await accept(
      await clientFor(currentServer.current).authenticate(input),
      currentServer.current,
    );
    await continueLocal();
  }
  async function changePassword(previous: string, next: string): Promise<void> {
    await accept(
      await clientFor(currentServer.current).changePassword(previous, next),
      currentServer.current,
    );
  }
  async function logout(): Promise<void> {
    // A failed remote revoke keeps the login visible so the user can retry.
    await clientFor(currentServer.current).logout();
    await invalidate();
  }
  async function refresh(): Promise<void> {
    const receipt = await clientFor(currentServer.current).me();
    if (receipt.user) await accept(receipt, currentServer.current);
    else await invalidate();
  }
  return (
    <AccountContext.Provider
      value={{
        server,
        credentials,
        policy,
        isLoading,
        needsEntry,
        error,
        client: clientFor(server),
        connect,
        authenticate,
        changePassword,
        logout,
        continueLocal,
        refresh,
      }}
    >
      {children}
    </AccountContext.Provider>
  );
}
export function useNativeAccount(): AccountState {
  const value = useContext(AccountContext);
  if (!value) throw new Error("缺少账号上下文。");
  return value;
}
