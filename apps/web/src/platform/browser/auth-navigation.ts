export const AUTH_ROUTE_EVENT = "hamster-auth-route";
const ACCESS_KEY = "hamster-ledger.workspace-access";
export function hasLocalAccess(): boolean {
  try {
    return ["local", "cloud", "allowed"].includes(
      sessionStorage.getItem(ACCESS_KEY) ?? "",
    );
  } catch {
    return false;
  }
}
export function isLocalChoice(): boolean {
  try {
    return ["local", "allowed"].includes(
      sessionStorage.getItem(ACCESS_KEY) ?? "",
    );
  } catch {
    return false;
  }
}
export function rememberLocalAccess(
  allowed: boolean,
  mode: "local" | "cloud" = "local",
): void {
  try {
    if (allowed) sessionStorage.setItem(ACCESS_KEY, mode);
    else sessionStorage.removeItem(ACCESS_KEY);
  } catch {
    /* In-memory access remains available if session storage is disabled. */
  }
}
export function safeReturnPath(
  value: string | null,
  origin = location.origin,
): string {
  try {
    const url = new URL(value ?? "/", origin);
    if (url.origin !== origin || url.pathname !== "/") return "/";
    const query = new URLSearchParams();
    if (url.searchParams.get("page") === "tools") query.set("page", "tools");
    if (url.searchParams.get("action") === "add") query.set("action", "add");
    return "/" + (query.size ? "?" + query.toString() : "");
  } catch {
    return "/";
  }
}
export function navigateAuth(path: string, replace = false): void {
  if (replace) history.replaceState(null, "", path);
  else history.pushState(null, "", path);
  window.dispatchEvent(new Event(AUTH_ROUTE_EVENT));
}
export function loginPath(
  mode: "login" | "register" = "login",
  returnTo = "/?page=tools",
): string {
  return (
    "/" + mode + "?returnTo=" + encodeURIComponent(safeReturnPath(returnTo))
  );
}
