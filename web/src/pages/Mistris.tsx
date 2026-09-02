import { useEffect, useState } from "react";
import { api, Mistri, WalletTxn } from "../api";
import { rupees, when } from "../format";
import { useI18n } from "../i18n";

export function Mistris() {
  const { t } = useI18n();
  const [list, setList] = useState<Mistri[]>([]);
  const [err, setErr] = useState("");
  const [msg, setMsg] = useState("");
  const [wallet, setWallet] = useState<{ mistri: Mistri; balance: number; txns: WalletTxn[] } | null>(null);
  const [payUtr, setPayUtr] = useState("");

  const load = () => api.mistris().then(setList).catch((e) => setErr(e.message));
  useEffect(() => { load(); /* eslint-disable-next-line */ }, []);

  const openWallet = async (m: Mistri) => {
    setErr(""); setMsg(""); setPayUtr("");
    try { const w = await api.wallet(m.id); setWallet({ mistri: m, balance: w.balance, txns: w.txns }); }
    catch (e) { setErr((e as Error).message); }
  };

  const payout = async () => {
    if (!wallet) return;
    setErr(""); setMsg("");
    try {
      const r = await api.payout(wallet.mistri.id, payUtr.trim());
      setMsg(t("payoutDone", { amt: rupees(r.paidOutPaise) }));
      await openWallet(wallet.mistri); // refresh drawer
      load();                          // refresh table balances
    } catch (e) { setErr((e as Error).message); }
  };

  const totalOwed = list.reduce((s, m) => s + m.walletBalance, 0);
  const totalEarned = list.reduce((s, m) => s + m.totalCashback, 0);

  return (
    <div>
      <h2>{t("mistrisTitle")}</h2>
      {err && <div className="err">{err}</div>}
      {msg && <div className="ok">{msg}</div>}

      <div className="row">
        <div className="card stat-card" style={{ flex: 1 }}>
          <div className="stat-ico">₹</div>
          <div className="stat-label">{t("totalOwed")}</div>
          <div className="stat">{rupees(totalOwed)}</div>
        </div>
        <div className="card stat-card" style={{ flex: 1 }}>
          <div className="stat-ico">🎁</div>
          <div className="stat-label">{t("earned")}</div>
          <div className="stat">{rupees(totalEarned)}</div>
        </div>
        <div className="card stat-card" style={{ flex: 1 }}>
          <div className="stat-ico">🔧</div>
          <div className="stat-label">{t("activeMistris")}</div>
          <div className="stat">{list.length}</div>
        </div>
      </div>

      {wallet && (
        <div className="card">
          <div className="spread">
            <h3 style={{ margin: 0 }}>{t("walletTitle", { name: wallet.mistri.name || wallet.mistri.phone })}</h3>
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
        <table>
          <thead><tr>
            <th>{t("name")}</th><th>{t("phone")}</th><th>{t("ordersCol")}</th>
            <th>{t("earned")}</th><th>{t("paidOutCol")}</th><th>{t("commissionOwed")}</th>
            <th>{t("lastActive")}</th><th></th>
          </tr></thead>
          <tbody>
            {list.map((m) => (
              <tr key={m.id}>
                <td>{m.name || "—"}</td>
                <td>{m.phone}</td>
                <td>{m.orderCount}</td>
                <td>{rupees(m.totalCashback)}</td>
                <td className="muted">{rupees(m.totalPaidOut)}</td>
                <td><strong>{rupees(m.walletBalance)}</strong></td>
                <td className="muted">{m.lastActivityAt ? when(m.lastActivityAt) : "—"}</td>
                <td>{m.walletBalance > 0
                  ? <button onClick={() => openWallet(m)}>{t("payOut")}</button>
                  : <button className="secondary" onClick={() => openWallet(m)}>{t("viewWallet")}</button>}</td>
              </tr>
            ))}
            {list.length === 0 && <tr><td colSpan={8} className="muted">{t("noMistris")}</td></tr>}
          </tbody>
        </table>
      </div>
    </div>
  );
}
