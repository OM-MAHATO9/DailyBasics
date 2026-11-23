import { useState } from "react";
import { api } from "../api";
import { Confirm, ErrorBox, Field, Loading, Modal, Switch, useLoad, useToast } from "../ui";

export default function Restaurants() {
  const toast = useToast();
  const { data: rests, setData, error, loading, reload } = useLoad<any[]>(() => api("/api/admin/restaurants"));
  const [editing, setEditing] = useState<any | null>(null);
  const [removing, setRemoving] = useState<any | null>(null);

  const save = async (r: any, patch: any, msg: string) => {
    const body = { ...pick(r), ...patch };
    setData((rs) => (rs || []).map((x) => (x.id === r.id ? { ...x, ...patch } : x)));
    try { await api(`/api/admin/restaurants/${r.id}`, { method: "PUT", body }); toast(msg, "ok"); }
    catch (e: any) { toast(e.message, "err"); reload(true); }
  };

  return (
    <>
      <div className="page-head">
        <div><h1>Restaurants</h1><p>Add the restaurants you deliver from. Customers can't order from a closed restaurant.</p></div>
        <button className="btn primary" onClick={() => setEditing({})}>+ Add restaurant</button>
      </div>
      {error && <ErrorBox error={error} retry={() => reload()} />}
      {loading && !rests ? <Loading /> : !rests?.length ? (
        <div className="card card-pad empty">
          <p className="strong" style={{ color: "var(--text)" }}>No restaurants yet</p>
          <p>Add your first restaurant, then add its dishes from the menu.</p>
          <button className="btn primary" onClick={() => setEditing({})}>+ Add restaurant</button>
        </div>
      ) : (
        <div className="rgrid">
          {rests.map((r) => (
            <article className="card rcard" key={r.id} style={{ opacity: r.is_active ? 1 : 0.6 }}>
              <div className="img" style={{ backgroundImage: r.image_url ? `url("${r.image_url}")` : undefined }}>
                {!r.is_active ? <span className="badge b-muted">Hidden from app</span>
                  : r.is_open ? <span className="badge b-ok">Open</span> : <span className="badge b-danger">Closed</span>}
              </div>
              <div className="body">
                <h3>{r.name}</h3>
                <div className="small muted">{[r.cuisine, `${r.eta_minutes} min`].filter(Boolean).join(" · ")}</div>
                {r.address && <div className="small muted" style={{ marginTop: 4 }}>{r.address}</div>}
                <div className="small" style={{ marginTop: 6 }}><a href={`#/menu?restaurant=${r.id}`}>{r.product_count || 0} menu items →</a></div>
              </div>
              <div className="foot">
                <Switch checked={!!r.is_open} label="Open for orders" disabled={!r.is_active}
                  onChange={(v) => save(r, { is_open: v }, `${r.name} is now ${v ? "open" : "closed"}`)} />
                <span className="small">{r.is_open ? "Taking orders" : "Closed"}</span>
                <span className="spacer" />
                <button className="btn sm" onClick={() => setEditing(r)}>Edit</button>
                <button className="btn sm danger" onClick={() => setRemoving(r)}>Remove</button>
              </div>
            </article>
          ))}
        </div>
      )}

      {editing && <RestaurantForm r={editing} onClose={() => setEditing(null)}
        onSaved={(msg) => { toast(msg, "ok"); setEditing(null); reload(true); }} />}
      {removing && (
        <Confirm title={`Remove ${removing.name}?`} danger confirmLabel="Remove restaurant"
          text={<>The restaurant disappears from the app and its {removing.product_count || 0} menu items are hidden (not deleted, so past orders stay intact). To pause it for a while, switch it to <strong>Closed</strong> instead.</>}
          onClose={() => setRemoving(null)}
          onConfirm={async () => {
            try { await api(`/api/admin/restaurants/${removing.id}`, { method: "DELETE" }); toast(`${removing.name} removed`, "ok"); reload(true); }
            catch (e: any) { toast(e.message, "err"); }
          }} />
      )}
    </>
  );
}

const pick = (r: any) => ({
  name: r.name, description: r.description || "", cuisine: r.cuisine || "", image_url: r.image_url || "",
  address: r.address || "", phone: r.phone || "", eta_minutes: Number(r.eta_minutes) || 30,
  is_open: r.is_open ?? true, is_active: r.is_active ?? true,
});

function RestaurantForm({ r, onClose, onSaved }: { r: any; onClose: () => void; onSaved: (msg: string) => void }) {
  const isNew = !r.id;
  const [f, setF] = useState<any>({ eta_minutes: 30, is_open: true, is_active: true, ...pick({ name: "", ...r }) });
  const [error, setError] = useState("");
  const [busy, setBusy] = useState(false);
  const set = (k: string, v: any) => setF((x: any) => ({ ...x, [k]: v }));

  const save = async () => {
    if (!f.name.trim()) return setError("Give the restaurant a name.");
    if (f.phone && !/^\d{10}$/.test(f.phone.replace(/\D/g, "").slice(-10))) return setError("Enter a 10-digit phone number, or leave it empty.");
    setBusy(true); setError("");
    try {
      const body = { ...pick(f), name: f.name.trim() };
      if (isNew) await api("/api/admin/restaurants", { method: "POST", body });
      else await api(`/api/admin/restaurants/${r.id}`, { method: "PUT", body });
      onSaved(`${body.name} ${isNew ? "added" : "saved"}`);
    } catch (e: any) { setError(e.message); }
    finally { setBusy(false); }
  };

  return (
    <Modal title={isNew ? "Add restaurant" : `Edit ${r.name}`} onClose={onClose} footer={<>
      <button className="btn" onClick={onClose}>Cancel</button>
      <button className="btn primary" onClick={save} disabled={busy}>{busy ? "Saving…" : "Save restaurant"}</button>
    </>}>
      {error && <div className="error-box">{error}</div>}
      <div className="form-grid">
        <Field label="Name" full><input className="input" value={f.name} onChange={(e) => set("name", e.target.value)} placeholder="e.g. Sharma Dhaba" /></Field>
        <Field label="Cuisine"><input className="input" value={f.cuisine} onChange={(e) => set("cuisine", e.target.value)} placeholder="North Indian, Chinese…" /></Field>
        <Field label="Delivery time (minutes)"><input className="input" type="number" min={5} value={f.eta_minutes} onChange={(e) => set("eta_minutes", e.target.value)} /></Field>
        <Field label="Phone"><input className="input" value={f.phone} onChange={(e) => set("phone", e.target.value)} placeholder="10-digit mobile" /></Field>
        <Field label="Address"><input className="input" value={f.address} onChange={(e) => set("address", e.target.value)} /></Field>
        <Field label="Photo link (image URL)" full><input className="input" value={f.image_url} onChange={(e) => set("image_url", e.target.value)} placeholder="https://…" /></Field>
        <Field label="Description" full><textarea className="input" value={f.description} onChange={(e) => set("description", e.target.value)} /></Field>
        <div className="full row" style={{ gap: 18 }}>
          <label className="check"><input type="checkbox" checked={f.is_open} onChange={(e) => set("is_open", e.target.checked)} /> Open for orders</label>
          <label className="check"><input type="checkbox" checked={f.is_active} onChange={(e) => set("is_active", e.target.checked)} /> Show in app</label>
        </div>
      </div>
    </Modal>
  );
}
