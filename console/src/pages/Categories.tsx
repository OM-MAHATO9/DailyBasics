import { useState } from "react";
import { api } from "../api";
import { ErrorBox, Field, Loading, Modal, Switch, useLoad, useToast } from "../ui";

export default function Categories() {
  const toast = useToast();
  const { data: cats, error, loading, reload } = useLoad<any[]>(() => api("/api/admin/categories"));
  const [editing, setEditing] = useState<any | null>(null);

  const toggle = async (c: any, v: boolean) => {
    try { await api(`/api/admin/categories/${c.id}`, { method: "PUT", body: { ...pick(c), is_active: v } }); toast(`${c.name} ${v ? "shown" : "hidden"}`, "ok"); reload(true); }
    catch (e: any) { toast(e.message, "err"); }
  };

  const groups = [["food", "Food"], ["essentials", "Groceries"]] as const;
  return (
    <>
      <div className="page-head">
        <div><h1>Categories</h1><p>The sections customers browse, like "Breakfast" or "Dairy & Milk".</p></div>
        <button className="btn primary" onClick={() => setEditing({ section: "food" })}>+ Add category</button>
      </div>
      {error && <ErrorBox error={error} retry={() => reload()} />}
      {loading && !cats ? <Loading /> : (
        <div className="grid-2">
          {groups.map(([key, label]) => (
            <div className="card table-wrap" key={key}>
              <div className="card-pad" style={{ paddingBottom: 0 }}><h3>{label}</h3></div>
              <table>
                <thead><tr><th></th><th>Name</th><th className="num">Order</th><th>In app</th><th></th></tr></thead>
                <tbody>
                  {(cats || []).filter((c) => c.section === key).map((c) => (
                    <tr key={c.id}>
                      <td style={{ width: 56 }}>{c.image ? <img className="thumb" src={c.image} alt="" /> : <div className="thumb" />}</td>
                      <td className="strong">{c.name}</td>
                      <td className="num">{c.order}</td>
                      <td><Switch checked={c.is_active !== false} label={`Show ${c.name}`} onChange={(v) => toggle(c, v)} /></td>
                      <td><button className="btn sm" onClick={() => setEditing(c)}>Edit</button></td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          ))}
        </div>
      )}
      {editing && <CategoryForm c={editing} onClose={() => setEditing(null)} onSaved={(m) => { toast(m, "ok"); setEditing(null); reload(true); }} />}
    </>
  );
}

const pick = (c: any) => ({ name: c.name, section: c.section || "food", icon: c.icon || "pricetag", image: c.image || "", order: Number(c.order) || 99, is_active: c.is_active !== false });

function CategoryForm({ c, onClose, onSaved }: { c: any; onClose: () => void; onSaved: (m: string) => void }) {
  const isNew = !c.id;
  const [f, setF] = useState<any>(pick({ name: "", ...c }));
  const [error, setError] = useState("");
  const [busy, setBusy] = useState(false);
  const set = (k: string, v: any) => setF((x: any) => ({ ...x, [k]: v }));
  const save = async () => {
    if (!f.name.trim()) return setError("Give the category a name.");
    setBusy(true); setError("");
    try {
      const body = { ...pick(f), name: f.name.trim() };
      if (isNew) await api("/api/admin/categories", { method: "POST", body });
      else await api(`/api/admin/categories/${c.id}`, { method: "PUT", body });
      onSaved(`${body.name} ${isNew ? "added" : "saved"}`);
    } catch (e: any) { setError(e.message); } finally { setBusy(false); }
  };
  return (
    <Modal title={isNew ? "Add category" : `Edit ${c.name}`} onClose={onClose} size="sm" footer={<>
      <button className="btn" onClick={onClose}>Cancel</button>
      <button className="btn primary" onClick={save} disabled={busy}>{busy ? "Saving…" : "Save"}</button>
    </>}>
      {error && <div className="error-box">{error}</div>}
      <div className="form-grid">
        <Field label="Name" full><input className="input" value={f.name} onChange={(e) => set("name", e.target.value)} /></Field>
        <Field label="Section"><select className="input" value={f.section} onChange={(e) => set("section", e.target.value)}><option value="food">Food</option><option value="essentials">Groceries</option></select></Field>
        <Field label="Position (1 = first)"><input className="input" type="number" min={1} value={f.order} onChange={(e) => set("order", e.target.value)} /></Field>
        <Field label="Photo link (image URL)" full><input className="input" value={f.image} onChange={(e) => set("image", e.target.value)} placeholder="https://…" /></Field>
      </div>
    </Modal>
  );
}
