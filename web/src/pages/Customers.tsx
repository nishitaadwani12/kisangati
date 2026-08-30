import { useEffect, useState } from "react";
import { api, Customer } from "../api";
import { rupees } from "../format";
import { useI18n } from "../i18n";

export function Customers() {
  const { t } = useI18n();
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
      setMsg(t("customerAdded"));
      setForm({ phone: "", name: "", userType: "FARMER", acquisitionChannel: "WALK_IN" });
      load();
    } catch (e) { setErr((e as Error).message); }
  };

  return (
    <div>
      <h2>{t("customers")}</h2>
      {err && <div className="err">{err}</div>}
      {msg && <div className="ok">{msg}</div>}

      <div className="card">
        <h3 style={{ marginTop: 0 }}>{t("onboardWalkin")}</h3>
        <div className="row">
          <div className="field"><label>{t("phone")}*</label><input value={form.phone} onChange={(e) => setForm({ ...form, phone: e.target.value })} placeholder="+9198…" /></div>
          <div className="field"><label>{t("name")}</label><input value={form.name} onChange={(e) => setForm({ ...form, name: e.target.value })} /></div>
          <div className="field"><label>{t("type")}</label>
            <select value={form.userType} onChange={(e) => setForm({ ...form, userType: e.target.value })}>
              <option value="FARMER">{t("type.FARMER")}</option><option value="MISTRI">{t("type.MISTRI")}</option>
            </select>
          </div>
          <div className="field"><label>{t("channel")}</label>
            <select value={form.acquisitionChannel} onChange={(e) => setForm({ ...form, acquisitionChannel: e.target.value })}>
              <option>WALK_IN</option><option>WHATSAPP</option><option>MISTRI_REFERRAL</option><option>APP</option>
            </select>
          </div>
          <button onClick={create} disabled={!form.phone}>{t("add")}</button>
        </div>
      </div>

      <div className="card">
        <div className="row" style={{ marginBottom: 10 }}>
          <input placeholder={t("searchNamePhone")} value={q} onChange={(e) => setQ(e.target.value)} onKeyDown={(e) => e.key === "Enter" && load()} />
          <button className="secondary" onClick={load}>{t("search")}</button>
        </div>
        <table>
          <thead><tr><th>{t("name")}</th><th>{t("phone")}</th><th>{t("type")}</th><th>{t("channel")}</th><th>{t("ordersCol")}</th><th>{t("wallet")}</th></tr></thead>
          <tbody>
            {list.map((c) => (
              <tr key={c.id}>
                <td>{c.name || "—"}</td><td>{c.phone}</td><td>{t(`type.${c.userType}`)}</td><td>{c.acquisitionChannel}</td>
                <td>{c._count?.orders ?? 0}</td>
                <td>{c.userType === "MISTRI" ? rupees(c.walletBalance) : "—"}</td>
              </tr>
            ))}
            {list.length === 0 && <tr><td colSpan={6} className="muted">{t("noCustomers")}</td></tr>}
          </tbody>
        </table>
      </div>
    </div>
  );
}
