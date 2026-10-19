import { createAccountOperations } from "./account-operations";
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
  const credentialOrigin = useRef("");
  const operations = useRef(createAccountOperations()).current;
  async function clearCredentials(version: number): Promise<void> {
    operations.assertCurrent(version);
    current.current = null;
    credentialOrigin.current = "";
    setCredentials(null);
    await operations.persist(version, () =>
      SecureStore.deleteItemAsync(SESSION_KEY),
    );
  }
  async function invalidate(): Promise<void> {
    await clearCredentials(operations.cancel());
  }
  function clientFor(origin: string): CloudClient {
    const version = operations.version();
    return createCloudClient({
      origin,
      getCredentials: () =>
        currentServer.current === origin && credentialOrigin.current === origin
          ? current.current
          : null,
      invalidate: async () => {
        if (operations.isCurrent(version) && currentServer.current === origin)
          await invalidate();
      },
    });
  }
  async function accept(
    receipt: AuthReceipt,
    origin: string,
    version: number,
  ): Promise<void> {
    operations.assertCurrent(version);
    if (currentServer.current !== origin) throw new Error("记账服务已变化。");
    const next = parseCredentials(
      receipt,
      credentialOrigin.current === origin
        ? current.current?.accessToken
        : undefined,
    );
    await operations.persist(version, () =>
      next.session.remember
        ? SecureStore.setItemAsync(
            SESSION_KEY,
            JSON.stringify({ origin, credentials: next }),
            { keychainAccessible: SecureStore.WHEN_UNLOCKED_THIS_DEVICE_ONLY },
          )
        : SecureStore.deleteItemAsync(SESSION_KEY),
    );
    current.current = next;
    credentialOrigin.current = origin;
    setCredentials(next);
    setNeedsEntry(false);
    setError("");
    if (receipt.policy) setPolicy(receipt.policy);
  }
  useEffect(() => {
    let active = true;
    void operations
      .run(async (version) => {
        try {
          const origin = await nativeStore.getItem(SERVER_KEY);
          const local = await nativeStore.getItem(LOCAL_KEY);
          const saved = await SecureStore.getItemAsync(SESSION_KEY);
          if (!active || !operations.isCurrent(version)) return;
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
              credentialOrigin.current = validated;
              current.current = next;
              setCredentials(next);
              setNeedsEntry(false);
            } else await clearCredentials(version);
          }
          const receipt = await clientFor(validated).me();
          if (!active || !operations.isCurrent(version)) return;
          if (receipt.policy) setPolicy(receipt.policy);
          if (receipt.user) await accept(receipt, validated, version);
          else await clearCredentials(version);
        } catch (cause) {
          if (active)
            setError(
              cause instanceof Error ? cause.message : "读取账号设置失败。",
            );
        } finally {
          if (active) setLoading(false);
        }
      })
      .catch((cause: unknown) => {
        if (active)
          setError(cause instanceof Error ? cause.message : "账号初始化失败。");
      });
    return () => {
      active = false;
      operations.cancel();
    };
  }, []);
  async function connect(value: string): Promise<void> {
    const origin = normalizeServer(value, __DEV__);
    await operations.run(async (version) => {
      if (currentServer.current !== origin) await clearCredentials(version);
      const receipt = await clientFor(origin).me();
      operations.assertCurrent(version);
      await operations.persist(version, () =>
        nativeStore.setItem(SERVER_KEY, origin),
      );
      currentServer.current = origin;
      setServer(origin);
      setPolicy(receipt.policy ?? null);
      setError("");
    });
  }
  async function rememberLocal(version: number): Promise<void> {
    await operations.persist(version, () =>
      nativeStore.setItem(LOCAL_KEY, "1"),
    );
    setNeedsEntry(false);
  }
  async function continueLocal(): Promise<void> {
    await operations.run(rememberLocal);
  }
  async function authenticate(input: {
    username: string;
    password: string;
    remember: boolean;
    isRegister: boolean;
  }): Promise<void> {
    await operations.run(async (version) => {
      const origin = currentServer.current;
      if (!origin) throw new Error("请先连接你的记账服务。");
      await accept(
        await clientFor(origin).authenticate(input),
        origin,
        version,
      );
      await rememberLocal(version);
    });
  }
  async function changePassword(previous: string, next: string): Promise<void> {
    await operations.run(async (version) => {
      const origin = currentServer.current;
      await accept(
        await clientFor(origin).changePassword(previous, next),
        origin,
        version,
      );
    });
  }
  async function logout(): Promise<void> {
    await operations.run(async (version) => {
      // Failed remote revocation retains the visible login so it can be retried.
      await clientFor(currentServer.current).logout();
      await clearCredentials(version);
    });
  }
  async function refresh(): Promise<void> {
    await operations.run(async (version) => {
      const origin = currentServer.current;
      const receipt = await clientFor(origin).me();
      if (receipt.user) await accept(receipt, origin, version);
      else await clearCredentials(version);
    });
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
