// Talks to the DailyBasics backend. The address is set at build time
// (CONSOLE_API_URL), so the console never stores any secret keys.
declare const __API_URL__: string;
export const API_URL = __API_URL__;

const TOKEN_KEY = "fmc_token";
const USER_KEY = "fmc_user";

function read(key: string): string | null {
  try { return localStorage.getItem(key); } catch { return null; }
}
function write(key: string, value: string | null) {
  try {
    if (value === null) localStorage.removeItem(key);
    else localStorage.setItem(key, value);
  } catch { /* storage blocked: session-only login */ }
}

let memToken: string | null = read(TOKEN_KEY);
let onUnauthorized: (() => void) | null = null;

export const session = {
  token: () => memToken,
  user: (): any => { try { return JSON.parse(read(USER_KEY) || "null"); } catch { return null; } },
  set(token: string, user: any) { memToken = token; write(TOKEN_KEY, token); write(USER_KEY, JSON.stringify(user)); },
  clear() { memToken = null; write(TOKEN_KEY, null); write(USER_KEY, null); },
  onUnauthorized(fn: () => void) { onUnauthorized = fn; },
};

export class ApiError extends Error {
  status: number;
  constructor(status: number, message: string) { super(message); this.status = status; }
}

export async function api<T = any>(path: string, opts: { method?: string; body?: any } = {}): Promise<T> {
  const headers: Record<string, string> = { "Content-Type": "application/json" };
  if (memToken) headers.Authorization = `Bearer ${memToken}`;
  let res: Response;
  try {
    res = await fetch(API_URL + path, {
      method: opts.method || "GET",
      headers,
      body: opts.body !== undefined ? JSON.stringify(opts.body) : undefined,
    });
  } catch {
    throw new ApiError(0, "Can't reach the server. If it was asleep, wait 30 seconds and try again.");
  }
  const data = await res.json().catch(() => ({}));
  if (res.status === 401 && path !== "/api/auth/admin/login") {
    session.clear();
    onUnauthorized?.();
  }
  if (!res.ok) {
    const detail = (data as any)?.detail;
    const msg = typeof detail === "string" ? detail
      : Array.isArray(detail) ? detail.map((d: any) => d.msg).join(", ")
      : `Request failed (${res.status})`;
    throw new ApiError(res.status, msg);
  }
  return data as T;
}

// ---------- Formatting helpers ----------
export const inr = (n: number | undefined | null) =>
  "₹" + Number(n || 0).toLocaleString("en-IN", { maximumFractionDigits: 2 });

export function ago(iso?: string) {
  if (!iso) return "";
  const s = Math.max(0, (Date.now() - new Date(iso).getTime()) / 1000);
  if (s < 60) return "just now";
  if (s < 3600) return `${Math.floor(s / 60)} min ago`;
  if (s < 86400) return `${Math.floor(s / 3600)} h ago`;
  return new Date(iso).toLocaleDateString("en-IN", { day: "numeric", month: "short" });
}

export const dateTime = (iso?: string) =>
  iso ? new Date(iso).toLocaleString("en-IN", { day: "numeric", month: "short", hour: "numeric", minute: "2-digit" }) : "";

export const STATUS_LABEL: Record<string, string> = {
  placed: "New",
  confirmed: "Confirmed",
  preparing: "Preparing",
  packed: "Packed",
  out_for_delivery: "Out for delivery",
  delivered: "Delivered",
  cancelled: "Cancelled",
};

export const PAY_LABEL: Record<string, [string, string]> = {
  paid: ["Paid", "b-ok"],
  pending: ["Unpaid", "b-warn"],
  failed: ["Payment failed", "b-danger"],
  refunded: ["Refunded", "b-info"],
  refund_failed: ["Refund failed", "b-danger"],
};
