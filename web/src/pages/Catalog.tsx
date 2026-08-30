import { useEffect, useState } from "react";
import { api, Sku } from "../api";
import { rupees, rupeesToPaise } from "../format";

export function Catalog() {
  const [skus, setSkus] = useState<Sku[]>([]);
  const [q, setQ] = useState("");
  const [err, setErr] = useState("");
  const [form, setForm] = useState({ name: "", brand: "", modelCompat: "", category: "MEDIUM", retail: "", mistri: "", wholesale: "", stock: "" });

  const load = () => api.skus(q || undefined).then(setSkus).catch((e) => setErr(e.message));
  useEffect(() => { load(); /* eslint-disable-next-line */ }, []);

  const create = async () => {
    setErr("");
    try {
      await api.createSku({
        name: form.name.trim(),
        brand: form.brand.trim() || undefined,
        modelCompat: form.modelCompat.trim() || undefined,
        category: form.category,
        retailPrice: rupeesToPaise(form.retail || 0),
        mistriPrice: form.mistri ? rupeesToPaise(form.mistri) : undefined,
        wholesalePrice: rupeesToPaise(form.wholesale || 0),
        stockQty: Number(form.stock) || 0,
      });
      setForm({ name: "", brand: "", modelCompat: "", category: "MEDIUM", retail: "", mistri: "", wholesale: "", stock: "" });
      load();
    } catch (e) { setErr((e as Error).message); }
  };

  const setStock = async (s: Sku, delta: number) => {
    setErr("");
    try { await api.patchSku(s.id, { stockQty: Math.max(0, s.stockQty + delta) }); load(); }
    catch (e) { setErr((e as Error).message); }
  };

  return (
    <div>
      <h2>Catalog</h2>
      {err && <div className="err">{err}</div>}

      <div className="card">
        <h3 style={{ marginTop: 0 }}>Add a part</h3>
        <div className="row">
          <div className="field"><label>Name*</label><input value={form.name} onChange={(e) => setForm({ ...form, name: e.target.value })} /></div>
          <div className="field"><label>Brand</label><input value={form.brand} onChange={(e) => setForm({ ...form, brand: e.target.value })} /></div>
          <div className="field"><label>Model fit</label><input value={form.modelCompat} onChange={(e) => setForm({ ...form, modelCompat: e.target.value })} /></div>
          <div className="field"><label>Tier</label>
            <select value={form.category} onChange={(e) => setForm({ ...form, category: e.target.value })}>
              <option>LOW</option><option>MEDIUM</option><option>HIGH</option>
            </select>
          </div>
          <div className="field"><label>Farmer ₹*</label><input type="number" value={form.retail} onChange={(e) => setForm({ ...form, retail: e.target.value })} /></div>
          <div className="field"><label>Mistri ₹</label><input type="number" value={form.mistri} onChange={(e) => setForm({ ...form, mistri: e.target.value })} placeholder="auto −10%" /></div>
          <div className="field"><label>Wholesale ₹</label><input type="number" value={form.wholesale} onChange={(e) => setForm({ ...form, wholesale: e.target.value })} /></div>
          <div className="field"><label>Stock</label><input type="number" value={form.stock} onChange={(e) => setForm({ ...form, stock: e.target.value })} /></div>
          <button onClick={create} disabled={!form.name || !form.retail}>Add</button>
        </div>
      </div>

      <div className="card">
        <div className="row" style={{ marginBottom: 10 }}>
          <input placeholder="Search parts…" value={q} onChange={(e) => setQ(e.target.value)} onKeyDown={(e) => e.key === "Enter" && load()} />
          <button className="secondary" onClick={load}>Search</button>
        </div>
        <table>
          <thead><tr><th>Name</th><th>Brand</th><th>Fit</th><th>Tier</th><th>Farmer ₹</th><th>Mistri ₹</th><th>Stock</th><th></th></tr></thead>
          <tbody>
            {skus.map((s) => (
              <tr key={s.id}>
                <td>{s.name}</td><td>{s.brand || "—"}</td><td>{s.modelCompat || "—"}</td><td>{s.category || "—"}</td>
                <td>{rupees(s.retailPrice)}</td>
                <td>{s.mistriPrice != null ? rupees(s.mistriPrice) : <span className="muted">{rupees(Math.round(s.retailPrice * 0.9))} (auto)</span>}</td>
                <td>{s.stockQty <= 5 ? <strong style={{ color: "#b3261e" }}>{s.stockQty}</strong> : s.stockQty}</td>
                <td className="row">
                  <button className="secondary" onClick={() => setStock(s, -1)}>−</button>
                  <button className="secondary" onClick={() => setStock(s, +1)}>+</button>
                </td>
              </tr>
            ))}
            {skus.length === 0 && <tr><td colSpan={8} className="muted">No parts yet.</td></tr>}
          </tbody>
        </table>
      </div>
    </div>
  );
}
