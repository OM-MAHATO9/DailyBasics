import { useState } from "react";
import { api, dateTime } from "../api";
import { ErrorBox, Field, Loading, Modal, Switch, useLoad, useToast } from "../ui";

export default function Riders() {
  const toast = useToast();
  const { data: riders, error, loading, reload } = useLoad<any[]>(() => api("/api/admin/partners"));
  const [adding, setAdding] = useState(false);

  const toggle = async (r: any, v: boolean) => {
    try { await api(`/api/admin/partners/${r.id}`, { method: "PATCH", body: { is_active: v } }); toast(`${r.name} ${v ? "activated" : "deactivated"}`, "ok"); reload(true); }
    catch (e: any) { toast(e.message, "err"); }
  };

  return (
    <>
      <div className="page-head">
        <div><h1>Riders</h1><p>Riders sign in to the DailyBasics app with their phone number to see the orders assigned to them.</p></div>
        <button className="btn primary" onClick={() => setAdding(true)}>+ Add rider</button>
      </div>
      {error && <ErrorBox error={error} retry={() => reload()} />}
      {loading && !riders ? <Loading /> : (
        <div className="card table-wrap">
          <table>
            <thead><tr><th>Name</th><th>Phone</th><th>Added</th><th>Active</th></tr></thead>
            <tbody>
              {(riders || []).map((r) => (
                <tr key={r.id} style={{ opacity: r.is_active ? 1 : 0.55 }}>
                  <td className="strong">{r.name}</td>
                  <td><a href={`tel:${r.phone}`}>{r.phone}</a></td>
                  <td>{dateTime(r.created_at)}</td>
                  <td><Switch checked={!!r.is_active} label={`${r.name} active`} onChange={(v) => toggle(r, v)} /></td>
                </tr>
              ))}
              {!riders?.length && <tr><td colSpan={4} className="empty">No riders yet.</td></tr>}
            </tbody>
          </table>
        </div>
      )}
      {adding && <RiderForm onClose={() => setAdding(false)} onSaved={(m) => { toast(m, "ok"); setAdding(false); reload(true); }} />}
    </>
  );
}

function RiderForm({ onClose, onSaved }: { onClose: () => void; onSaved: (m: string) => void }) {
  const [name, setName] = useState("");
  const [phone, setPhone] = useState("");
  const [error, setError] = useState("");
  const [busy, setBusy] = useState(false);
  const save = async () => {
    if (!name.trim()) return setError("Enter the rider's name.");
    if (!/^\d{10}$/.test(phone.replace(/\D/g, "").replace(/^91(?=\d{10}$)/, ""))) return setError("Enter a 10-digit mobile number.");
    setBusy(true); setError("");
    try { await api("/api/admin/partners", { method: "POST", body: { name: name.trim(), phone, is_active: true } }); onSaved(`${name.trim()} added`); }
    catch (e: any) { setError(e.message); } finally { setBusy(false); }
  };
  return (
    <Modal title="Add rider" onClose={onClose} size="sm" footer={<>
      <button className="btn" onClick={onClose}>Cancel</button>
      <button className="btn primary" onClick={save} disabled={busy}>{busy ? "Adding…" : "Add rider"}</button>
    </>}>
      {error && <div className="error-box">{error}</div>}
      <div className="form-grid">
        <Field label="Name" full><input className="input" value={name} onChange={(e) => setName(e.target.value)} /></Field>
        <Field label="Mobile number" full><input className="input" inputMode="numeric" value={phone} onChange={(e) => setPhone(e.target.value)} placeholder="98xxxxxxxx" /></Field>
      </div>
    </Modal>
  );
}
