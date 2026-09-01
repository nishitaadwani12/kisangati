import { useEffect, useState } from "react";
import { api, Customer, WalletTxn } from "../api";
import { rupees, when } from "../format";
import { useI18n } from "../i18n";

export function Customers() {
  const { t } = useI18n();
  const [list, setList] = useState<Customer[]>([]);
  const [q, setQ] = useState("");
  const [err, setErr] = useState("");
  const [msg, setMsg] = useState("");
  const [form, setForm] = useState({ phone: "", name: "", userType: "FARMER", acquisitionChannel: "WALK_IN" });
  const [wallet, setWallet] = useState<{ customer: Customer; balance: number; txns: WalletTxn[] } | null>(null);
  const [payUtr, setPayUtr] = useState("");

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

  const openWallet = async (c: Customer) => {
    setErr(""); setMsg(""); setPayUtr("");
    try { const w = await api.wallet(c.id); setWallet({ customer: c, balance: w.balance, txns: w.txns }); }
    catch (e) { setErr((e as Error).message); }
  };

  const payout = async () => {
    if (!wallet) return;
    setErr(""); setMsg("");
    try {
      const r = await api.payout(wallet.customer.id, payUtr.trim());
      setMsg(t("payoutDone", { amt: rupees(r.paidOutPaise) }));
      await openWallet(wallet.customer); // refresh panel
      load(); // refresh balances in the table
    } catch (e) { setErr((e as Error).message); }
  };

  return (
    <div>
      <h2>{t("customers")}</h2>
      {err && <div className="err">{err}</div>}
      {msg && <div className="ok">{msg}</div>}

      {wallet && (
        <div className="card">
          <div className="spread">
            <h3 style={{ margin: 0 }}>{t("walletTitle", { name: wallet.customer.name || wallet.customer.phone })}</h3>
            <button className="secondary" onClick={() => setWallet(null)}>{t("close")}</button>
          </div>
          <p><strong>{t("balance")}: {rupees(wallet.balance)}</strong></p>
          {wallet.balance > 0 && (
            <div className="row" style={{ marginBottom: 10 }}>
              <div className="field"><label>{t("payoutUtr")}</label><input value={payUtr} onChange={(e) => setPayUtr(e.target.value)} placeholder="e.g. 412345678901" /></div>
              <button onClick={payout} disabled={!payUtr.trim()}>{t("payOut")} {rupees(wallet.balance)}</button>
            </div>
          )}
          <table>
            <thead><tr><th>{t("created")}</th><th>{t("txnType")}</th><th>{t("amount")}</th><th>{t("ref")}</th></tr></thead>
            <tbody>
              {wallet.txns.map((tx) => (
                <tr key={tx.id}>
                  <td className="muted">{when(tx.createdAt)}</td>
                  <td>{tx.type === "CASHBACK" ? t("cashback") : t("payoutLabel")}</td>
                  <td>{tx.type === "CASHBACK" ? "+" : "−"}{rupees(tx.amount)}</td>
                  <td>{tx.ref || "—"}</td>
                </tr>
              ))}
              {wallet.txns.length === 0 && <tr><td colSpan={4} className="muted">{t("noTxns")}</td></tr>}
            </tbody>
          </table>
        </div>
      )}

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
                <td>{c.userType === "MISTRI"
                  ? <span className="row">{rupees(c.walletBalance)} <button className="secondary" onClick={() => openWallet(c)}>{t("viewWallet")}</button></span>
                  : "—"}</td>
              </tr>
            ))}
            {list.length === 0 && <tr><td colSpan={6} className="muted">{t("noCustomers")}</td></tr>}
          </tbody>
        </table>
      </div>
    </div>
  );
}
