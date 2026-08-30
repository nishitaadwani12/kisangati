import { useEffect, useState } from "react";
import { api, ShopWithCounts } from "../api";
import { useI18n } from "../i18n";

export function Shops() {
  const { t } = useI18n();
  const [list, setList] = useState<ShopWithCounts[]>([]);
  const [err, setErr] = useState("");
  const [msg, setMsg] = useState("");
  const [form, setForm] = useState({ shopName: "", town: "", ownerEmail: "", ownerName: "", password: "" });

  const load = () => api.shops().then(setList).catch((e) => setErr(e.message));
  useEffect(() => { load(); }, []);

  const create = async () => {
    setErr(""); setMsg("");
    try {
      await api.createShop({
        shopName: form.shopName.trim(),
        town: form.town.trim() || undefined,
        ownerEmail: form.ownerEmail.trim(),
        ownerName: form.ownerName.trim() || undefined,
        password: form.password,
      });
      setMsg(t("shopCreated"));
      setForm({ shopName: "", town: "", ownerEmail: "", ownerName: "", password: "" });
      load();
    } catch (e) { setErr((e as Error).message); }
  };

  return (
    <div>
      <h2>{t("shopsTitle")}</h2>
      {err && <div className="err">{err}</div>}
      {msg && <div className="ok">{msg}</div>}

      <div className="card">
        <h3 style={{ marginTop: 0 }}>{t("addShop")}</h3>
        <div className="row">
          <div className="field"><label>{t("shopName")}*</label><input value={form.shopName} onChange={(e) => setForm({ ...form, shopName: e.target.value })} /></div>
          <div className="field"><label>{t("town")}</label><input value={form.town} onChange={(e) => setForm({ ...form, town: e.target.value })} /></div>
          <div className="field"><label>{t("ownerEmail")}*</label><input value={form.ownerEmail} onChange={(e) => setForm({ ...form, ownerEmail: e.target.value })} placeholder="owner@gmail.com" /></div>
          <div className="field"><label>{t("ownerName")}</label><input value={form.ownerName} onChange={(e) => setForm({ ...form, ownerName: e.target.value })} /></div>
          <div className="field"><label>{t("tempPassword")}*</label><input value={form.password} onChange={(e) => setForm({ ...form, password: e.target.value })} /></div>
          <button onClick={create} disabled={!form.shopName || !form.ownerEmail || form.password.length < 6}>{t("create")}</button>
        </div>
      </div>

      <div className="card">
        <table>
          <thead><tr><th>{t("shopName")}</th><th>{t("town")}</th><th>{t("nav.orders")}</th><th>{t("nav.customers")}</th><th>{t("nav.catalog")}</th></tr></thead>
          <tbody>
            {list.map((s) => (
              <tr key={s.id}>
                <td>{s.name}</td><td>{s.town || "—"}</td>
                <td>{s._count.orders}</td><td>{s._count.users}</td><td>{s._count.skus}</td>
              </tr>
            ))}
            {list.length === 0 && <tr><td colSpan={5} className="muted">{t("noShops")}</td></tr>}
          </tbody>
        </table>
      </div>
    </div>
  );
}
