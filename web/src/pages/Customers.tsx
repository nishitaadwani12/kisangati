import { useEffect, useState } from "react";
import { api, Customer } from "../api";
import { rupees } from "../format";

export function Customers() {
  const [list, setList] = useState<Customer[]>([]);
  const [q, setQ] = useState("");
  const [err, setErr] = useState("");
  const [msg, setMsg] = useState("");
  const [form, setForm] = useState({ phone: "", name: "", userType: "FARMER", acquisitionChannel: "WALK_IN" });

  const load = () => api.customers(q || undefined).then(setList).catch((e) => setErr(e.message));
  useEffect(() => { load(); /* eslint-disable-next-line */ }, []);

  const create = async () => {
    setErr(""); setMsg("");
    try {
      await api.createCustomer({ phone: form.phone.trim(), name: form.name.trim() || undefined, userType: form.userType, acquisitionChannel: form.acquisitionChannel });
      setMsg("Customer added — introduce both the app and WhatsApp at the counter.");
      setForm({ phone: "", name: "", userType: "FARMER", acquisitionChannel: "WALK_IN" });
      load();
    } catch (e) { setErr((e as Error).message); }
  };

  return (
    <div>
      <h2>Customers</h2>
      {err && <div className="err">{err}</div>}
      {msg && <div className="ok">{msg}</div>}

      <div className="card">
        <h3 style={{ marginTop: 0 }}>Onboard a customer (walk-in)</h3>
        <div className="row">
          <div className="field"><label>Phone*</label><input value={form.phone} onChange={(e) => setForm({ ...form, phone: e.target.value })} placeholder="+9198…" /></div>
          <div className="field"><label>Name</label><input value={form.name} onChange={(e) => setForm({ ...form, name: e.target.value })} /></div>
          <div className="field"><label>Type</label>
            <select value={form.userType} onChange={(e) => setForm({ ...form, userType: e.target.value })}>
              <option>FARMER</option><option>MISTRI</option>
            </select>
          </div>
          <div className="field"><label>Channel</label>
            <select value={form.acquisitionChannel} onChange={(e) => setForm({ ...form, acquisitionChannel: e.target.value })}>
              <option>WALK_IN</option><option>WHATSAPP</option><option>MISTRI_REFERRAL</option><option>APP</option>
            </select>
          </div>
          <button onClick={create} disabled={!form.phone}>Add</button>
        </div>
      </div>

      <div className="card">
        <div className="row" style={{ marginBottom: 10 }}>
          <input placeholder="Search by name or phone…" value={q} onChange={(e) => setQ(e.target.value)} onKeyDown={(e) => e.key === "Enter" && load()} />
          <button className="secondary" onClick={load}>Search</button>
        </div>
        <table>
          <thead><tr><th>Name</th><th>Phone</th><th>Type</th><th>Channel</th><th>Orders</th><th>Wallet</th></tr></thead>
          <tbody>
            {list.map((c) => (
              <tr key={c.id}>
                <td>{c.name || "—"}</td><td>{c.phone}</td><td>{c.userType}</td><td>{c.acquisitionChannel}</td>
                <td>{c._count?.orders ?? 0}</td>
                <td>{c.userType === "MISTRI" ? rupees(c.walletBalance) : "—"}</td>
              </tr>
            ))}
            {list.length === 0 && <tr><td colSpan={6} className="muted">No customers yet.</td></tr>}
          </tbody>
        </table>
      </div>
    </div>
  );
}
