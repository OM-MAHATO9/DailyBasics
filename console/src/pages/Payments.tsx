import { useMemo, useState } from "react";
import { api, dateTime, inr } from "../api";
import { ErrorBox, Loading, PayBadge, StatusBadge, useLoad, useToast } from "../ui";

const FILTERS: [string, string][] = [
  ["all", "All online"], ["paid", "Paid"], ["pending", "Unpaid"], ["failed", "Failed"],
  ["refunded", "Refunded"], ["refund_failed", "Refund failed"], ["cod", "Cash on delivery"],
];

export default function Payments() {
  const toast = useToast();
  const { data: orders, error, loading, reload } = useLoad<any[]>(() => api("/api/admin/orders"));
  const [filter, setFilter] = useState("all");
  const [busyId, setBusyId] = useState("");

  const online = (orders || []).filter((o) => o.payment_method === "online");
  const cod = (orders || []).filter((o) => o.payment_method !== "online");
  const sum = (list: any[]) => list.reduce((s, o) => s + Number(o.total || 0), 0);
  const by = (st: string) => online.filter((o) => o.payment_status === st);
  const needsRefund = online.filter((o) => o.status === "cancelled" && ["paid", "refund_failed"].includes(o.payment_status));

  const list = useMemo(() => {
    if (filter === "cod") return cod;
    if (filter === "all") return online;
    return online.filter((o) => o.payment_status === filter);
  }, [orders, filter]); // eslint-disable-line react-hooks/exhaustive-deps

  const refund = async (o: any) => {
    setBusyId(o.id);
    try { await api(`/api/admin/orders/${o.id}/refund`, { method: "POST" }); toast(`Refund sent for #${o.order_number}`, "ok"); reload(true); }
    catch (e: any) { toast(e.message, "err"); }
    finally { setBusyId(""); }
  };

  return (
    <>
      <div className="page-head">
        <div><h1>Payments</h1><p>Online payments go through Razorpay. Full details are in the <a href="https://dashboard.razorpay.com/app/payments" target="_blank" rel="noreferrer">Razorpay dashboard</a>.</p></div>
        <button className="btn" onClick={() => reload()}>Refresh</button>
      </div>
      {error && <ErrorBox error={error} retry={() => reload()} />}
      {loading && !orders ? <Loading /> : (
        <>
          <div className="stats">
            <Stat label="Received online" value={inr(sum(by("paid")))} sub={`${by("paid").length} payments`} />
            <Stat label="Waiting for payment" value={inr(sum(by("pending").filter((o) => o.status !== "cancelled")))} sub={`${by("pending").filter((o) => o.status !== "cancelled").length} orders`} />
            <Stat label="Failed payments" value={by("failed").length} sub="customer can retry" />
            <Stat label="Refunded" value={inr(sum(by("refunded")))} sub={`${by("refunded").length} orders`} />
            <Stat label="Cash collected" value={inr(cod.reduce((s, o) => s + Number(o.collected_amount || 0), 0))} sub={`${cod.filter((o) => o.status === "delivered").length} COD deliveries`} />
          </div>
          {needsRefund.length > 0 && (
            <div className="error-box">{needsRefund.length} cancelled order{needsRefund.length > 1 ? "s were" : " was"} paid but not refunded yet. Use <strong>Refund</strong> below.</div>
          )}
          <div className="row" style={{ marginBottom: 12 }}>
            <div className="tabs" role="tablist" style={{ flexWrap: "wrap" }}>
              {FILTERS.map(([k, l]) => <button key={k} className={filter === k ? "on" : ""} onClick={() => setFilter(k)}>{l}</button>)}
            </div>
          </div>
          <div className="card table-wrap">
            <table>
              <thead><tr><th>Order</th><th>Customer</th><th>Date</th><th>Order status</th><th>Payment</th><th>Razorpay ID</th><th className="num">Amount</th><th></th></tr></thead>
              <tbody>
                {list.map((o) => (
                  <tr key={o.id}>
                    <td className="strong">#{o.order_number}</td>
                    <td>{o.user_name || "—"}<div className="small muted">{o.user_phone}</div></td>
                    <td>{dateTime(o.created_at)}</td>
                    <td><StatusBadge status={o.status} /></td>
                    <td><PayBadge order={o} /></td>
                    <td className="small muted">{o.razorpay_payment_id || o.razorpay_order_id || "—"}</td>
                    <td className="num strong">{inr(o.total)}</td>
                    <td>
                      {o.status === "cancelled" && o.payment_method === "online" && ["paid", "refund_failed"].includes(o.payment_status) &&
                        <button className="btn sm" disabled={busyId === o.id} onClick={() => refund(o)}>{busyId === o.id ? "Refunding…" : "Refund"}</button>}
                    </td>
                  </tr>
                ))}
                {!list.length && <tr><td colSpan={8} className="empty">Nothing here.</td></tr>}
              </tbody>
            </table>
          </div>
        </>
      )}
    </>
  );
}

function Stat({ label, value, sub }: { label: string; value: any; sub?: string }) {
  return <div className="card stat"><div className="label">{label}</div><div className="value">{value}</div>{sub && <div className="sub">{sub}</div>}</div>;
}
