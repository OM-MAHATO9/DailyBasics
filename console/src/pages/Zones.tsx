import { useState } from "react";
import { api, inr } from "../api";
import { Confirm, ErrorBox, Field, Loading, Modal, Switch, useLoad, useToast } from "../ui";

export default function Zones() {
  const toast = useToast();
  const { data: zones, error, loading, reload } = useLoad<any[]>(() => api("/api/delivery/zones"));
  const [editing, setEditing] = useState<any | null>(null);
  const [removing, setRemoving] = useState<any | null>(null);

  const toggle = async (z: any, v: boolean) => {
    try { await api(`/api/admin/zones/${z.id}`, { method: "PUT", body: { ...pick(z), is_active: v } }); toast(`${z.name} ${v ? "on" : "paused"}`, "ok"); reload(true); }
    catch (e: any) { toast(e.message, "err"); }
  };

  return (
    <>
      <div className="page-head">
        <div><h1>Delivery areas</h1><p>Customers can order only if their pincode is in an active area.</p></div>
        <button className="btn primary" onClick={() => setEditing({})}>+ Add area</button>
      </div>
      {error && <ErrorBox error={error} retry={() => reload()} />}
      {loading && !zones ? <Loading /> : (
        <div className="card table-wrap">
          <table>
            <thead><tr><th>Area</th><th>Pincodes</th><th className="num">Delivery fee</th><th className="num">Min. order</th><th className="num">Time</th><th>Active</th><th></th></tr></thead>
            <tbody>
              {(zones || []).map((z) => (
                <tr key={z.id}>
                  <td className="strong">{z.name}</td>
                  <td>{(z.pincodes || []).map((p: string) => <span key={p} className="badge b-muted" style={{ marginRight: 4 }}>{p}</span>)}</td>
                  <td className="num">{inr(z.delivery_charge)}</td>
                  <td className="num">{inr(z.min_order_value)}</td>
                  <td className="num">{z.eta_minutes} min</td>
                  <td><Switch checked={!!z.is_active} label={`${z.name} active`} onChange={(v) => toggle(z, v)} /></td>
                  <td style={{ whiteSpace: "nowrap" }}>
                    <button className="btn sm" onClick={() => setEditing(z)}>Edit</button>{" "}
                    <button className="btn sm danger" onClick={() => setRemoving(z)}>Delete</button>
                  </td>
                </tr>
              ))}
              {!zones?.length && <tr><td colSpan={7} className="empty">No delivery areas. Add one so customers can order.</td></tr>}
            </tbody>
          </table>
        </div>
      )}
      {editing && <ZoneForm z={editing} onClose={() => setEditing(null)} onSaved={(m) => { toast(m, "ok"); setEditing(null); reload(true); }} />}
      {removing && (
        <Confirm title={`Delete ${removing.name}?`} danger confirmLabel="Delete area"
          text={<>Customers in {removing.pincodes?.join(", ")} won't be able to order any more. To stop deliveries for a while, switch the area off instead.</>}
          onClose={() => setRemoving(null)}
          onConfirm={async () => {
            try { await api(`/api/admin/zones/${removing.id}`, { method: "DELETE" }); toast(`${removing.name} deleted`, "ok"); reload(true); }
            catch (e: any) { toast(e.message, "err"); }
          }} />
      )}
    </>
  );
}

const pick = (z: any) => ({
  name: z.name, pincodes: z.pincodes || [], delivery_charge: Number(z.delivery_charge) || 0,
  min_order_value: Number(z.min_order_value) || 0, eta_minutes: Number(z.eta_minutes) || 30, is_active: z.is_active ?? true,
});

function ZoneForm({ z, onClose, onSaved }: { z: any; onClose: () => void; onSaved: (m: string) => void }) {
  const isNew = !z.id;
  const [f, setF] = useState<any>(pick({ name: "", delivery_charge: 20, min_order_value: 99, eta_minutes: 30, ...z }));
  const [pins, setPins] = useState((z.pincodes || []).join(", "));
  const [error, setError] = useState("");
  const [busy, setBusy] = useState(false);
  const set = (k: string, v: any) => setF((x: any) => ({ ...x, [k]: v }));
  const save = async () => {
    const list = pins.split(/[\s,]+/).map((p: string) => p.trim()).filter(Boolean);
    if (!f.name.trim()) return setError("Give the area a name.");
    const bad = list.filter((p: string) => !/^\d{6}$/.test(p));
    if (!list.length) return setError("Add at least one pincode.");
    if (bad.length) return setError(`Not 6-digit pincodes: ${bad.join(", ")}`);
    setBusy(true); setError("");
    try {
      const body = { ...pick(f), name: f.name.trim(), pincodes: list };
      if (isNew) await api("/api/admin/zones", { method: "POST", body });
      else await api(`/api/admin/zones/${z.id}`, { method: "PUT", body });
      onSaved(`${body.name} ${isNew ? "added" : "saved"}`);
    } catch (e: any) { setError(e.message); } finally { setBusy(false); }
  };
  return (
    <Modal title={isNew ? "Add delivery area" : `Edit ${z.name}`} onClose={onClose} footer={<>
      <button className="btn" onClick={onClose}>Cancel</button>
      <button className="btn primary" onClick={save} disabled={busy}>{busy ? "Saving…" : "Save area"}</button>
    </>}>
      {error && <div className="error-box">{error}</div>}
      <div className="form-grid">
        <Field label="Area name" full><input className="input" value={f.name} onChange={(e) => set("name", e.target.value)} placeholder="e.g. Town centre" /></Field>
        <Field label="Pincodes (separate with commas)" full><textarea className="input" value={pins} onChange={(e) => setPins(e.target.value)} placeholder="834001, 834002" /></Field>
        <Field label="Delivery fee (₹)"><input className="input" type="number" min={0} value={f.delivery_charge} onChange={(e) => set("delivery_charge", e.target.value)} /></Field>
        <Field label="Minimum order (₹)"><input className="input" type="number" min={0} value={f.min_order_value} onChange={(e) => set("min_order_value", e.target.value)} /></Field>
        <Field label="Delivery time (minutes)"><input className="input" type="number" min={5} value={f.eta_minutes} onChange={(e) => set("eta_minutes", e.target.value)} /></Field>
        <label className="check" style={{ alignSelf: "end", paddingBottom: 8 }}><input type="checkbox" checked={f.is_active} onChange={(e) => set("is_active", e.target.checked)} /> Active</label>
      </div>
    </Modal>
  );
}
