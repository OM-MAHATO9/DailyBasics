import { useEffect, useMemo, useState } from "react";
import { api, ago, dateTime, inr, STATUS_LABEL } from "../api";
import { Confirm, Drawer, ErrorBox, Loading, PayBadge, StatusBadge, useLoad, useToast } from "../ui";

const BOARD = ["placed", "confirmed", "preparing", "packed", "out_for_delivery"] as const;
const NEXT: Record<string, { to: string; label: string }> = {
  placed: { to: "confirmed", label: "Accept order" },
  confirmed: { to: "preparing", label: "Start preparing" },
  preparing: { to: "packed", label: "Mark packed" },
  packed: { to: "out_for_delivery", label: "Send out for delivery" },
  out_for_delivery: { to: "delivered", label: "Mark delivered" },
};
const POLL_MS = 10000;

export default function Orders() {
  const toast = useToast();
  const [tab, setTab] = useState<"board" | "history">("board");
  const [openId, setOpenId] = useState<string | null>(null);
  const [q, setQ] = useState("");
  const { data: orders, error, loading, reload } = useLoad<any[]>(() => api("/api/admin/orders"));
  const { data: riders } = useLoad<any[]>(() => api("/api/admin/partners"));

  // Keep the board live
  useEffect(() => {
    const t = setInterval(() => reload(true), POLL_MS);
    return () => clearInterval(t);
  }, [reload]);

  const filtered = useMemo(() => {
    const term = q.trim().toLowerCase();
    if (!term) return orders || [];
    return (orders || []).filter((o) =>
      [o.order_number, o.user_name, o.user_phone, o.address?.phone, o.address?.village]
        .some((v) => String(v || "").toLowerCase().includes(term)));
  }, [orders, q]);

  const byStatus = (s: string) => filtered.filter((o) => o.status === s);
  const history = filtered.filter((o) => o.status === "delivered" || o.status === "cancelled");
  const open = (orders || []).find((o) => o.id === openId) || null;

  return (
    <>
      <div className="page-head">
        <div><h1>Live orders</h1><p>Updates every 10 seconds. Click an order to accept it, assign a rider, or cancel it.</p></div>
        <div className="row">
          <input className="input" placeholder="Search order no., name, phone…" value={q} onChange={(e) => setQ(e.target.value)} style={{ width: 240 }} />
          <div className="tabs" role="tablist">
            <button className={tab === "board" ? "on" : ""} onClick={() => setTab("board")}>In progress</button>
            <button className={tab === "history" ? "on" : ""} onClick={() => setTab("history")}>Completed & cancelled</button>
          </div>
        </div>
      </div>
      {error && <ErrorBox error={error} retry={() => reload()} />}
      {loading && !orders ? <Loading /> : tab === "board" ? (
        <div className="board">
          {BOARD.map((s) => {
            const list = byStatus(s);
            return (
              <section className="col" key={s} aria-label={STATUS_LABEL[s]}>
                <div className="col-head"><span>{STATUS_LABEL[s]}</span><span className="n">{list.length}</span></div>
                {list.map((o) => <OrderCard key={o.id} o={o} onOpen={() => setOpenId(o.id)} />)}
                {!list.length && <div className="empty">No orders</div>}
              </section>
            );
          })}
        </div>
      ) : (
        <div className="card table-wrap">
          <table>
            <thead><tr><th>Order</th><th>Customer</th><th>Placed</th><th>Status</th><th>Payment</th><th className="num">Total</th></tr></thead>
            <tbody>
              {history.map((o) => (
                <tr key={o.id} style={{ cursor: "pointer" }} onClick={() => setOpenId(o.id)}>
                  <td className="strong">#{o.order_number}</td>
                  <td>{o.user_name || "—"}<div className="small muted">{o.address?.phone || o.user_phone}</div></td>
                  <td>{dateTime(o.created_at)}</td>
                  <td><StatusBadge status={o.status} /></td>
                  <td><PayBadge order={o} /></td>
                  <td className="num strong">{inr(o.total)}</td>
                </tr>
              ))}
              {!history.length && <tr><td colSpan={6} className="empty">No completed or cancelled orders yet.</td></tr>}
            </tbody>
          </table>
        </div>
      )}
      {open && (
        <OrderDrawer order={open} riders={(riders || []).filter((r) => r.is_active)} onClose={() => setOpenId(null)}
          onChanged={async (msg) => { toast(msg, "ok"); await reload(true); }} />
      )}
    </>
  );
}

function OrderCard({ o, onOpen }: { o: any; onOpen: () => void }) {
  const count = (o.items || []).reduce((n: number, it: any) => n + it.quantity, 0);
  return (
    <button className={`ocard ${o.status === "placed" ? "fresh" : ""}`} onClick={onOpen}
      style={{ display: "block", width: "100%", textAlign: "left" }}>
      <div className="top"><span className="num">#{o.order_number}</span><span className="amt">{inr(o.total)}</span></div>
      <div className="meta">{o.user_name || "Customer"} · {count} item{count === 1 ? "" : "s"} · {ago(o.created_at)}</div>
      <div className="meta">{[o.address?.village, o.address?.pincode].filter(Boolean).join(", ")}</div>
      <div className="badges">
        <PayBadge order={o} />
        {o.delivery_partner_name ? <span className="badge b-info">🛵 {o.delivery_partner_name}</span>
          : o.status !== "placed" && <span className="badge b-warn">No rider</span>}
      </div>
    </button>
  );
}

function OrderDrawer({ order: o, riders, onClose, onChanged }: {
  order: any; riders: any[]; onClose: () => void; onChanged: (msg: string) => Promise<void>;
}) {
  const toast = useToast();
  const [busy, setBusy] = useState(false);
  const [rider, setRider] = useState(o.delivery_partner_id || "");
  const [confirm, setConfirm] = useState<null | "cancel" | "unpaid">(null);
  const next = NEXT[o.status];
  const unpaidOnline = o.payment_method === "online" && o.payment_status !== "paid";
  const needsRider = next?.to === "out_for_delivery" && !o.delivery_partner_id;

  const run = async (fn: () => Promise<any>, msg: string) => {
    setBusy(true);
    try { await fn(); await onChanged(msg); }
    catch (e: any) { toast(e.message, "err"); }
    finally { setBusy(false); }
  };

  const setStatus = (to: string) => run(() => api(`/api/orders/${o.id}/status`, {
    method: "PATCH",
    body: to === "delivered" && o.payment_method !== "online" ? { status: to, collected_amount: o.total } : { status: to },
  }), `#${o.order_number}: ${STATUS_LABEL[to]}`);

  const advance = () => {
    if (!next) return;
    if (o.status === "placed" && unpaidOnline) { setConfirm("unpaid"); return; }
    setStatus(next.to);
  };

  const assign = () => run(() => api(`/api/orders/${o.id}/assign`, { method: "POST", body: { delivery_partner_id: rider } }),
    `Rider assigned to #${o.order_number}`);

  const refund = () => run(() => api(`/api/admin/orders/${o.id}/refund`, { method: "POST" }), "Refund sent to Razorpay");

  const a = o.address || {};
  return (
    <Drawer onClose={onClose}>
      <div className="dhead">
        <div>
          <h2>Order #{o.order_number}</h2>
          <div className="row small muted" style={{ marginTop: 4 }}>
            <StatusBadge status={o.status} /><PayBadge order={o} /><span>{dateTime(o.created_at)}</span>
          </div>
        </div>
        <button className="btn ghost sm" onClick={onClose} aria-label="Close">✕</button>
      </div>

      {unpaidOnline && o.status !== "cancelled" && (
        <div className="error-box" style={{ background: "var(--warn-tint)", color: "var(--warn)" }}>
          Online payment not received yet. The customer can still pay from their order page.
        </div>
      )}

      {next && (
        <div className="actions" style={{ marginTop: 0 }}>
          <button className="btn primary" disabled={busy || needsRider} onClick={advance}>{next.label}</button>
          {needsRider && <span className="small muted">Assign a rider first.</span>}
        </div>
      )}

      {o.status !== "delivered" && o.status !== "cancelled" && (
        <div className="section">
          <h4>Rider</h4>
          <div className="row">
            <select className="input" value={rider} onChange={(e) => setRider(e.target.value)} style={{ flex: 1 }}>
              <option value="">Choose a rider…</option>
              {riders.map((r) => <option key={r.id} value={r.id}>{r.name} ({r.phone})</option>)}
            </select>
            <button className="btn" disabled={busy || !rider || rider === o.delivery_partner_id} onClick={assign}>
              {o.delivery_partner_id ? "Change" : "Assign"}
            </button>
          </div>
          {!riders.length && <p className="small muted">No active riders. <a href="#/riders">Add one →</a></p>}
        </div>
      )}

      <div className="section">
        <h4>Customer & address</h4>
        <div className="kv">
          <span className="k">Name</span><span>{o.user_name || "—"}</span>
          <span className="k">Phone</span><span><a href={`tel:${a.phone || o.user_phone}`}>{a.phone || o.user_phone}</a></span>
          <span className="k">Address</span><span>{[a.house, a.landmark, a.village, a.pincode].filter(Boolean).join(", ")}</span>
          {o.instructions && <><span className="k">Instructions</span><span>{o.instructions}</span></>}
          {a.instructions && <><span className="k">Delivery note</span><span>{a.instructions}</span></>}
          <span className="k">Area</span><span>{o.zone_name}</span>
        </div>
      </div>

      <div className="section">
        <h4>Items</h4>
        <div className="items-list">
          {(o.items || []).map((it: any, i: number) => (
            <div className="it" key={i}><span>{it.quantity} × {it.name} <span className="muted small">{it.unit}</span></span><span>{inr(it.line_total)}</span></div>
          ))}
        </div>
        <div className="kv" style={{ marginTop: 10 }}>
          <span className="k">Subtotal</span><span>{inr(o.subtotal)}</span>
          <span className="k">Delivery</span><span>{inr(o.delivery_charge)}</span>
          {o.coupon_discount > 0 && <><span className="k">Coupon {o.coupon_code}</span><span>−{inr(o.coupon_discount)}</span></>}
          {o.wallet_applied > 0 && <><span className="k">Wallet</span><span>−{inr(o.wallet_applied)}</span></>}
          <span className="k strong">Total</span><span className="strong">{inr(o.total)}</span>
        </div>
      </div>

      <div className="section">
        <h4>Payment</h4>
        <div className="kv">
          <span className="k">Method</span><span>{o.payment_method === "online" ? "Online (Razorpay)" : "Cash on delivery"}</span>
          <span className="k">Status</span><span><PayBadge order={o} /></span>
          {o.razorpay_payment_id && <><span className="k">Payment ID</span><span className="small">{o.razorpay_payment_id}</span></>}
          {o.razorpay_refund_id && <><span className="k">Refund ID</span><span className="small">{o.razorpay_refund_id}</span></>}
          {o.collected_amount != null && <><span className="k">Cash collected</span><span>{inr(o.collected_amount)}</span></>}
        </div>
        {o.status === "cancelled" && o.payment_method === "online" && ["paid", "refund_failed"].includes(o.payment_status) && (
          <button className="btn" style={{ marginTop: 10 }} disabled={busy} onClick={refund}>Retry refund</button>
        )}
      </div>

      <div className="section">
        <h4>Timeline</h4>
        <ul className="timeline">
          {(o.status_history || []).map((h: any, i: number) => (
            <li key={i}><span>{STATUS_LABEL[h.status] || h.status}</span><span className="muted">{dateTime(h.at)}</span></li>
          ))}
        </ul>
      </div>

      {o.status !== "delivered" && o.status !== "cancelled" && (
        <div className="actions"><button className="btn danger" disabled={busy} onClick={() => setConfirm("cancel")}>Cancel order</button></div>
      )}

      {confirm === "cancel" && (
        <Confirm title={`Cancel order #${o.order_number}?`} danger confirmLabel="Cancel order"
          text={<>Stock goes back to the menu{o.wallet_applied > 0 ? ", wallet money is returned" : ""}
            {o.payment_method === "online" && o.payment_status === "paid" ? <>, and <strong>{inr(o.total)} is refunded</strong> to the customer through Razorpay</> : ""}.
            This can't be undone.</>}
          onConfirm={() => setStatus("cancelled")} onClose={() => setConfirm(null)} />
      )}
      {confirm === "unpaid" && (
        <Confirm title="Accept an unpaid order?" confirmLabel="Accept anyway"
          text="This order was meant to be paid online, but no payment has arrived yet. You can accept it and wait for payment, or wait before accepting."
          onConfirm={() => setStatus("confirmed")} onClose={() => setConfirm(null)} />
      )}
    </Drawer>
  );
}
