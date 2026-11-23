import { createContext, useCallback, useContext, useEffect, useState, type ReactNode } from "react";
import { PAY_LABEL, STATUS_LABEL } from "./api";

// ---------- Toasts ----------
type Toast = { id: number; text: string; kind: "ok" | "err" | "info" };
const ToastCtx = createContext<(text: string, kind?: Toast["kind"]) => void>(() => {});
export const useToast = () => useContext(ToastCtx);

export function ToastProvider({ children }: { children: ReactNode }) {
  const [toasts, setToasts] = useState<Toast[]>([]);
  const push = useCallback((text: string, kind: Toast["kind"] = "info") => {
    const id = Date.now() + Math.random();
    setToasts((t) => [...t, { id, text, kind }].slice(-3)); // keep the newest three
    setTimeout(() => setToasts((t) => t.filter((x) => x.id !== id)), kind === "err" ? 6000 : 3500);
  }, []);
  return (
    <ToastCtx.Provider value={push}>
      {children}
      <div className="toasts" role="status" aria-live="polite">
        {toasts.map((t) => <div key={t.id} className={`toast ${t.kind}`}>{t.text}</div>)}
      </div>
    </ToastCtx.Provider>
  );
}

// ---------- Overlays ----------
export function Modal({ title, onClose, children, size, footer }: {
  title: string; onClose: () => void; children: ReactNode; size?: "sm"; footer?: ReactNode;
}) {
  useEffect(() => {
    const k = (e: KeyboardEvent) => e.key === "Escape" && onClose();
    window.addEventListener("keydown", k);
    return () => window.removeEventListener("keydown", k);
  }, [onClose]);
  return (
    <div className="overlay" onMouseDown={(e) => e.target === e.currentTarget && onClose()}>
      <div className={`modal ${size || ""}`} role="dialog" aria-modal="true" aria-label={title}>
        <div className="dhead">
          <h2>{title}</h2>
          <button className="btn ghost sm" onClick={onClose} aria-label="Close">✕</button>
        </div>
        {children}
        {footer && <div className="actions" style={{ justifyContent: "flex-end" }}>{footer}</div>}
      </div>
    </div>
  );
}

export function Drawer({ onClose, children }: { onClose: () => void; children: ReactNode }) {
  useEffect(() => {
    const k = (e: KeyboardEvent) => e.key === "Escape" && onClose();
    window.addEventListener("keydown", k);
    return () => window.removeEventListener("keydown", k);
  }, [onClose]);
  return (
    <div className="overlay" onMouseDown={(e) => e.target === e.currentTarget && onClose()}>
      <div className="drawer" role="dialog" aria-modal="true">{children}</div>
    </div>
  );
}

/** In-page confirmation (no browser confirm() popups). */
export function Confirm({ title, text, confirmLabel = "Yes, continue", danger, onConfirm, onClose }: {
  title: string; text: ReactNode; confirmLabel?: string; danger?: boolean;
  onConfirm: () => Promise<void> | void; onClose: () => void;
}) {
  const [busy, setBusy] = useState(false);
  return (
    <Modal title={title} onClose={onClose} size="sm" footer={<>
      <button className="btn" onClick={onClose} disabled={busy}>Go back</button>
      <button className={`btn ${danger ? "danger solid" : "primary"}`} disabled={busy}
        onClick={async () => { setBusy(true); try { await onConfirm(); onClose(); } finally { setBusy(false); } }}>
        {busy ? "Working…" : confirmLabel}
      </button>
    </>}>
      <div className="muted">{text}</div>
    </Modal>
  );
}

// ---------- Small pieces ----------
export function Switch({ checked, onChange, label, disabled }: {
  checked: boolean; onChange: (v: boolean) => void; label: string; disabled?: boolean;
}) {
  return (
    <label className="switch" title={label}>
      <input type="checkbox" checked={checked} disabled={disabled} aria-label={label}
        onChange={(e) => onChange(e.target.checked)} />
      <span />
    </label>
  );
}

export function Field({ label, children, full }: { label: string; children: ReactNode; full?: boolean }) {
  return <label className={`field ${full ? "full" : ""}`}><span>{label}</span>{children}</label>;
}

export function PayBadge({ order }: { order: any }) {
  const [text, cls] = PAY_LABEL[order.payment_status] || [order.payment_status, "b-muted"];
  const method = order.payment_method === "online" ? "Online" : "COD";
  if (order.payment_method !== "online" && order.payment_status === "pending")
    return <span className="badge b-muted">COD</span>;
  return <span className={`badge ${cls}`}>{method} · {text}</span>;
}

const STATUS_CLS: Record<string, string> = {
  placed: "b-warn", confirmed: "b-brand", preparing: "b-brand", packed: "b-brand",
  out_for_delivery: "b-info", delivered: "b-ok", cancelled: "b-danger",
};
export function StatusBadge({ status }: { status: string }) {
  return <span className={`badge ${STATUS_CLS[status] || "b-muted"}`}>{STATUS_LABEL[status] || status}</span>;
}

export function Loading({ text = "Loading…" }: { text?: string }) {
  return <div className="loading">{text}</div>;
}

export function ErrorBox({ error, retry }: { error: string; retry?: () => void }) {
  return (
    <div className="error-box row">
      <span>{error}</span>
      {retry && <button className="btn sm" onClick={retry}>Try again</button>}
    </div>
  );
}

/** Load data from the API with loading/error state. */
export function useLoad<T>(fn: () => Promise<T>, deps: any[] = []) {
  const [data, setData] = useState<T | null>(null);
  const [error, setError] = useState("");
  const [loading, setLoading] = useState(true);
  const load = useCallback(async (quiet = false) => {
    if (!quiet) setLoading(true);
    try { setData(await fn()); setError(""); }
    catch (e: any) { setError(e.message || "Something went wrong"); }
    finally { setLoading(false); }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, deps);
  useEffect(() => { load(); }, [load]);
  return { data, setData, error, loading, reload: load };
}
