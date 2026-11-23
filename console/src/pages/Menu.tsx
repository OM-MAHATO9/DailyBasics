import { useMemo, useState } from "react";
import { api, inr } from "../api";
import { Confirm, ErrorBox, Field, Loading, Modal, Switch, useLoad, useToast } from "../ui";

export default function Menu({ initialRestaurant = "" }: { initialRestaurant?: string }) {
  const toast = useToast();
  const [section, setSection] = useState(initialRestaurant ? "food" : "");
  const [restaurant, setRestaurant] = useState(initialRestaurant);
  const [category, setCategory] = useState("");
  const [q, setQ] = useState("");
  const [editing, setEditing] = useState<any | null>(null);
  const [deleting, setDeleting] = useState<any | null>(null);

  const { data: products, setData: setProducts, error, loading, reload } = useLoad<any[]>(() => api("/api/admin/products"));
  const { data: cats } = useLoad<any[]>(() => api("/api/admin/categories"));
  const { data: rests } = useLoad<any[]>(() => api("/api/admin/restaurants"));

  const catName = (id: string) => cats?.find((c) => c.id === id)?.name || "—";
  const restName = (id?: string) => (id && rests?.find((r) => r.id === id)?.name) || "";

  const list = useMemo(() => {
    const term = q.trim().toLowerCase();
    return (products || []).filter((p) =>
      (!section || p.section === section) &&
      (!category || p.category_id === category) &&
      (!restaurant || (restaurant === "none" ? !p.restaurant_id : p.restaurant_id === restaurant)) &&
      (!term || [p.name, p.brand, ...(p.keywords || [])].some((v) => String(v || "").toLowerCase().includes(term))));
  }, [products, section, category, restaurant, q]);

  // Optimistic quick edit (show/hide, stock)
  const quick = async (p: any, patch: any, msg: string) => {
    setProducts((ps) => (ps || []).map((x) => (x.id === p.id ? { ...x, ...patch } : x)));
    try {
      const updated = await api(`/api/admin/products/${p.id}`, { method: "PATCH", body: patch });
      setProducts((ps) => (ps || []).map((x) => (x.id === p.id ? updated : x)));
      toast(msg, "ok");
    } catch (e: any) {
      toast(e.message, "err");
      reload(true);
    }
  };

  return (
    <>
      <div className="page-head">
        <div><h1>Menu & products</h1><p>{list.length} of {products?.length ?? 0} items. Hidden items don't show in the app.</p></div>
        <button className="btn primary" onClick={() => setEditing({ section: section || "food", restaurant_id: restaurant && restaurant !== "none" ? restaurant : null })}>+ Add item</button>
      </div>

      <div className="row card card-pad" style={{ marginBottom: 14 }}>
        <input className="input" placeholder="Search items…" value={q} onChange={(e) => setQ(e.target.value)} style={{ flex: "1 1 200px" }} />
        <select className="input" value={section} onChange={(e) => { setSection(e.target.value); setCategory(""); }} aria-label="Section">
          <option value="">All sections</option><option value="food">Food</option><option value="essentials">Groceries</option>
        </select>
        <select className="input" value={restaurant} onChange={(e) => setRestaurant(e.target.value)} aria-label="Restaurant">
          <option value="">All restaurants</option><option value="none">Store items (no restaurant)</option>
          {(rests || []).map((r) => <option key={r.id} value={r.id}>{r.name}</option>)}
        </select>
        <select className="input" value={category} onChange={(e) => setCategory(e.target.value)} aria-label="Category">
          <option value="">All categories</option>
          {(cats || []).filter((c) => !section || c.section === section).map((c) => <option key={c.id} value={c.id}>{c.name}</option>)}
        </select>
      </div>

      {error && <ErrorBox error={error} retry={() => reload()} />}
      {loading && !products ? <Loading /> : (
        <div className="card table-wrap">
          <table>
            <thead><tr><th></th><th>Item</th><th>Category</th><th className="num">Price</th><th className="num">Stock</th><th>In app</th><th></th></tr></thead>
            <tbody>
              {list.map((p) => (
                <tr key={p.id} style={{ opacity: p.is_active ? 1 : 0.55 }}>
                  <td style={{ width: 56 }}>{p.image_url ? <img className="thumb" src={p.image_url} alt="" loading="lazy" /> : <div className="thumb" />}</td>
                  <td>
                    <div className="strong">{p.name}</div>
                    <div className="small muted">{[restName(p.restaurant_id), p.brand, p.unit].filter(Boolean).join(" · ")}</div>
                  </td>
                  <td>{catName(p.category_id)}<div className="small muted">{p.section === "food" ? "Food" : "Groceries"}</div></td>
                  <td className="num">{inr(p.price)}{p.mrp > p.price && <div className="small muted" style={{ textDecoration: "line-through" }}>{inr(p.mrp)}</div>}</td>
                  <td className="num">
                    <StockInput value={p.stock} onSave={(v) => quick(p, { stock: v }, `${p.name}: stock ${v}`)} />
                    {p.stock <= 5 && <div className="small" style={{ color: "var(--warn)" }}>Low</div>}
                  </td>
                  <td><Switch checked={!!p.is_active} label={`Show ${p.name} in app`}
                    onChange={(v) => quick(p, { is_active: v }, `${p.name} ${v ? "shown in app" : "hidden"}`)} /></td>
                  <td style={{ whiteSpace: "nowrap" }}>
                    <button className="btn sm" onClick={() => setEditing(p)}>Edit</button>{" "}
                    <button className="btn sm danger" onClick={() => setDeleting(p)}>Delete</button>
                  </td>
                </tr>
              ))}
              {!list.length && <tr><td colSpan={7} className="empty">No items match. Try other filters, or add an item.</td></tr>}
            </tbody>
          </table>
        </div>
      )}

      {editing && (
        <ProductForm product={editing} cats={cats || []} rests={rests || []} onClose={() => setEditing(null)}
          onSaved={(msg) => { toast(msg, "ok"); setEditing(null); reload(true); }} />
      )}
      {deleting && (
        <Confirm title={`Delete ${deleting.name}?`} danger confirmLabel="Delete item"
          text="It's removed from the menu for good. Past orders keep their details. To take it off the app for a while, switch it off instead."
          onClose={() => setDeleting(null)}
          onConfirm={async () => {
            try { await api(`/api/products/${deleting.id}`, { method: "DELETE" }); toast(`${deleting.name} deleted`, "ok"); reload(true); }
            catch (e: any) { toast(e.message, "err"); }
          }} />
      )}
    </>
  );
}

function StockInput({ value, onSave }: { value: number; onSave: (v: number) => void }) {
  const [v, setV] = useState(String(value));
  const [last, setLast] = useState(value);
  if (value !== last) { setLast(value); setV(String(value)); }
  const commit = () => {
    const n = parseInt(v, 10);
    if (Number.isNaN(n) || n < 0) { setV(String(value)); return; }
    if (n !== value) onSave(n);
  };
  return (
    <input className="input inline-num" type="number" min={0} value={v} aria-label="Stock"
      onChange={(e) => setV(e.target.value)} onBlur={commit}
      onKeyDown={(e) => { if (e.key === "Enter") (e.target as HTMLInputElement).blur(); }} style={{ textAlign: "right" }} />
  );
}

function ProductForm({ product, cats, rests, onClose, onSaved }: {
  product: any; cats: any[]; rests: any[]; onClose: () => void; onSaved: (msg: string) => void;
}) {
  const isNew = !product.id;
  const [f, setF] = useState<any>({
    name: "", brand: "", description: "", section: "food", category_id: "", image_url: "",
    mrp: "", price: "", unit: "1 plate", stock: 50, keywords: [], is_bestseller: false, is_featured: false,
    is_active: true, restaurant_id: null, ...product,
  });
  const [kw, setKw] = useState((product.keywords || []).join(", "));
  const [error, setError] = useState("");
  const [busy, setBusy] = useState(false);
  const set = (k: string, v: any) => setF((x: any) => ({ ...x, [k]: v }));
  const sectionCats = cats.filter((c) => c.section === f.section);

  const save = async () => {
    setError("");
    const price = Number(f.price), mrp = Number(f.mrp || f.price);
    if (!f.name.trim()) return setError("Give the item a name.");
    if (!f.category_id) return setError("Choose a category.");
    if (!(price > 0)) return setError("Enter a price above ₹0.");
    if (mrp < price) return setError("MRP can't be lower than the selling price.");
    const body = {
      name: f.name.trim(), brand: f.brand || "", description: f.description || "", category_id: f.category_id,
      section: f.section, image_url: (f.image_url || "").trim(), mrp, price, unit: f.unit || "1 pc",
      stock: Math.max(0, parseInt(f.stock, 10) || 0),
      keywords: kw.split(",").map((s: string) => s.trim()).filter(Boolean),
      is_bestseller: !!f.is_bestseller, is_featured: !!f.is_featured, is_active: !!f.is_active,
      restaurant_id: f.restaurant_id || null,
    };
    setBusy(true);
    try {
      if (isNew) await api("/api/products", { method: "POST", body });
      else await api(`/api/products/${product.id}`, { method: "PUT", body });
      onSaved(`${body.name} ${isNew ? "added" : "saved"}`);
    } catch (e: any) { setError(e.message); }
    finally { setBusy(false); }
  };

  return (
    <Modal title={isNew ? "Add menu item" : `Edit ${product.name}`} onClose={onClose} footer={<>
      <button className="btn" onClick={onClose}>Cancel</button>
      <button className="btn primary" onClick={save} disabled={busy}>{busy ? "Saving…" : "Save item"}</button>
    </>}>
      {error && <div className="error-box">{error}</div>}
      <div className="form-grid">
        <Field label="Name" full><input className="input" value={f.name} onChange={(e) => set("name", e.target.value)} placeholder="e.g. Veg Thali" /></Field>
        <Field label="Section">
          <select className="input" value={f.section} onChange={(e) => { set("section", e.target.value); set("category_id", ""); }}>
            <option value="food">Food</option><option value="essentials">Groceries</option>
          </select>
        </Field>
        <Field label="Category">
          <select className="input" value={f.category_id} onChange={(e) => set("category_id", e.target.value)}>
            <option value="">Choose…</option>
            {sectionCats.map((c) => <option key={c.id} value={c.id}>{c.name}{c.is_active === false ? " (hidden)" : ""}</option>)}
          </select>
        </Field>
        <Field label="Restaurant" full>
          <select className="input" value={f.restaurant_id || ""} onChange={(e) => set("restaurant_id", e.target.value || null)}>
            <option value="">None: sold by the store</option>
            {rests.map((r) => <option key={r.id} value={r.id}>{r.name}{r.is_active === false ? " (hidden)" : ""}</option>)}
          </select>
        </Field>
        <Field label="Selling price (₹)"><input className="input" type="number" min={0} step="0.5" value={f.price} onChange={(e) => set("price", e.target.value)} /></Field>
        <Field label="MRP (₹, optional)"><input className="input" type="number" min={0} step="0.5" value={f.mrp} onChange={(e) => set("mrp", e.target.value)} placeholder="Same as price" /></Field>
        <Field label="Unit / portion"><input className="input" value={f.unit} onChange={(e) => set("unit", e.target.value)} placeholder="1 plate, 500 g, 1 L…" /></Field>
        <Field label="Stock"><input className="input" type="number" min={0} value={f.stock} onChange={(e) => set("stock", e.target.value)} /></Field>
        <Field label="Brand (optional)"><input className="input" value={f.brand} onChange={(e) => set("brand", e.target.value)} /></Field>
        <Field label="Search words (comma separated)"><input className="input" value={kw} onChange={(e) => setKw(e.target.value)} placeholder="thali, lunch, veg" /></Field>
        <Field label="Photo link (image URL)" full>
          <div className="row">
            <input className="input" style={{ flex: 1 }} value={f.image_url} onChange={(e) => set("image_url", e.target.value)} placeholder="https://…" />
            {f.image_url && <img className="thumb" src={f.image_url} alt="Preview" />}
          </div>
        </Field>
        <Field label="Description" full><textarea className="input" value={f.description} onChange={(e) => set("description", e.target.value)} /></Field>
        <div className="full row" style={{ gap: 18 }}>
          <label className="check"><input type="checkbox" checked={f.is_active} onChange={(e) => set("is_active", e.target.checked)} /> Show in app</label>
          <label className="check"><input type="checkbox" checked={f.is_bestseller} onChange={(e) => set("is_bestseller", e.target.checked)} /> Bestseller</label>
          <label className="check"><input type="checkbox" checked={f.is_featured} onChange={(e) => set("is_featured", e.target.checked)} /> Featured</label>
        </div>
      </div>
    </Modal>
  );
}
