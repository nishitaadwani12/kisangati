import { useEffect, useState } from "react";
import { useParams, Link } from "react-router-dom";
import { api, Order, Sku } from "../api";
import { rupees, rupeesToPaise, when, suggestedPricePaise } from "../format";
import { Badge } from "../components/Layout";
import { useI18n } from "../i18n";

type Line = { skuId: string; name: string; qty: number; unitPriceRupees: number };

export function OrderDetail() {
  const { t } = useI18n();
  const { id = "" } = useParams();
  const [order, setOrder] = useState<Order | null>(null);
  const [skus, setSkus] = useState<Sku[]>([]);
  const [lines, setLines] = useState<Line[]>([]);
  const [err, setErr] = useState("");
  const [msg, setMsg] = useState("");
  const [upiLink, setUpiLink] = useState("");
  const [otp, setOtp] = useState("");

  const load = async () => {
    setErr(""); setMsg("");
    try {
      const o = await api.order(id);
      setOrder(o);
      if (o.items.length && lines.length === 0)
        setLines(o.items.map((it) => ({ skuId: it.skuId, name: it.sku?.name || it.skuId, qty: it.qty, unitPriceRupees: it.unitPrice / 100 })));
    } catch (e) { setErr((e as Error).message); }
  };
  useEffect(() => { load(); api.skus().then(setSkus).catch(() => {}); /* eslint-disable-next-line */ }, [id]);

  const act = async (fn: () => Promise<unknown>, okMsg?: string) => {
    setErr(""); setMsg("");
    try { await fn(); if (okMsg) setMsg(okMsg); await load(); }
    catch (e) { setErr((e as Error).message); }
  };

  if (!order) return <div>{err ? <div className="err">{err}</div> : t("loading")}</div>;

  const editable = order.status === "RECEIVED" || order.status === "QUOTED";
  const addLine = (skuId: string) => {
    const s = skus.find((x) => x.id === skuId);
    if (!s) return;
    const price = suggestedPricePaise(s, order.user.userType);
    setLines([...lines, { skuId: s.id, name: s.name, qty: 1, unitPriceRupees: price / 100 }]);
  };
  const saveItems = () =>
    act(() => api.setItems(id, lines.map((l) => ({ skuId: l.skuId, qty: l.qty, unitPrice: rupeesToPaise(l.unitPriceRupees) }))), t("saveItems"));

  return (
    <div>
      <div className="spread">
        <h2><Link to="/orders">{t("orders")}</Link> / {order.id.slice(-6)}</h2>
        <Badge status={order.status} />
      </div>
      {err && <div className="err">{err}</div>}
      {msg && <div className="ok">{msg}</div>}

      <div className="card">
        <div className="spread">
          <div>
            <strong>{order.user.name || order.user.phone}</strong> <span className="muted">({t(`type.${order.user.userType}`)})</span><br />
            <span className="muted">{order.user.phone} · {order.orderSource} · {when(order.createdAt)}</span>
          </div>
          {order.tractorBrand && <span className="pill">{order.tractorBrand} {order.model}</span>}
        </div>
        {order.rawText && <p style={{ marginBottom: 4 }}>“{order.rawText}”</p>}
        {order.mediaUrl && (/\.(ogg|mp3|m4a|wav)$/i.test(order.mediaUrl)
          ? <audio controls src={order.mediaUrl} />
          : <img src={order.mediaUrl} alt="part" style={{ maxWidth: 260, borderRadius: 8 }} />)}
      </div>

      {/* Items */}
      <div className="card">
        <h3 style={{ marginTop: 0 }}>{t("partsAndPrice")}</h3>
        <table>
          <thead><tr><th>{t("part")}</th><th>{t("qty")}</th><th>{t("unit")}</th><th>{t("line")}</th>{editable && <th></th>}</tr></thead>
          <tbody>
            {lines.map((l, i) => (
              <tr key={i}>
                <td>{l.name}</td>
                <td>{editable ? <input type="number" min={1} value={l.qty} style={{ width: 64 }}
                  onChange={(e) => setLines(lines.map((x, j) => j === i ? { ...x, qty: Number(e.target.value) } : x))} /> : l.qty}</td>
                <td>{editable ? <input type="number" min={0} value={l.unitPriceRupees} style={{ width: 90 }}
                  onChange={(e) => setLines(lines.map((x, j) => j === i ? { ...x, unitPriceRupees: Number(e.target.value) } : x))} /> : `₹${l.unitPriceRupees}`}</td>
                <td>₹{(l.qty * l.unitPriceRupees).toLocaleString("en-IN")}</td>
                {editable && <td><button className="secondary" onClick={() => setLines(lines.filter((_, j) => j !== i))}>✕</button></td>}
              </tr>
            ))}
            {lines.length === 0 && <tr><td colSpan={5} className="muted">{t("noPartsMatched")}</td></tr>}
          </tbody>
        </table>
        {editable && (
          <div className="row" style={{ marginTop: 10 }}>
            <select defaultValue="" onChange={(e) => { addLine(e.target.value); e.currentTarget.value = ""; }}>
              <option value="" disabled>{t("addPartOption")}</option>
              {skus.map((s) => <option key={s.id} value={s.id}>{s.name} {s.brand ? `(${s.brand})` : ""} — {rupees(suggestedPricePaise(s, order.user.userType))}</option>)}
            </select>
            <button onClick={saveItems} disabled={lines.length === 0}>{t("saveItems")}</button>
            <span className="muted">{order.user.userType === "MISTRI" ? t("pricesShownMistri") : t("pricesShownFarmer")}</span>
          </div>
        )}
        <div className="spread" style={{ marginTop: 12 }}>
          <span className="muted">{t("subtotalDelivery", { s: rupees(order.subtotal), d: rupees(order.deliveryFee) })}</span>
          <strong>{t("totalLabel", { t: rupees(order.total) })}</strong>
        </div>
      </div>

      {(order.status === "RECEIVED" || order.status === "QUOTED") && order.total > 0 && (
        <div className="card">
          <h3 style={{ marginTop: 0 }}>{t("quoteAndUpi")}</h3>
          <button onClick={() => act(async () => { const r = await api.quote(id); setUpiLink(r.upiLink); }, t("quoteSent"))}>
            {t("generateUpi")}
          </button>
          {upiLink && <p style={{ marginTop: 10 }}>{t("sendToCustomer")} <br /><code>{upiLink}</code></p>}
        </div>
      )}

      {order.status === "QUOTED" && <ConfirmPayment id={id} onDone={load} setErr={setErr} setMsg={setMsg} />}

      {order.status === "PAID" && <Dispatch id={id} onDone={load} setErr={setErr} setOtp={setOtp} otp={otp} />}

      {order.status === "DISPATCHED" && (
        <div className="card">
          <h3 style={{ marginTop: 0 }}>{t("confirmDeliveryOtp")}</h3>
          {order.delivery && <p className="muted">{t("onBusConductor", { route: order.delivery.busRoute || "", name: order.delivery.conductorName || "" })}</p>}
          <DeliverForm id={id} onDone={load} setErr={setErr} setMsg={setMsg} />
        </div>
      )}

      {order.payment && (
        <div className="card">
          <h3 style={{ marginTop: 0 }}>{t("payment")}</h3>
          <p className="muted">
            {order.payment.method} · {order.payment.status}
            {order.payment.utr && <> · UTR <code>{order.payment.utr}</code></>}
            {order.payment.confirmedBy && <> · {t("by")} {order.payment.confirmedBy}</>}
          </p>
        </div>
      )}
    </div>
  );
}

function ConfirmPayment({ id, onDone, setErr, setMsg }: { id: string; onDone: () => void; setErr: (s: string) => void; setMsg: (s: string) => void }) {
  const { t } = useI18n();
  const [utr, setUtr] = useState("");
  const [by, setBy] = useState("");
  return (
    <div className="card">
      <h3 style={{ marginTop: 0 }}>{t("confirmPaymentReceived")}</h3>
      <p className="muted">{t("verifyPaymentMsg")}</p>
      <div className="row">
        <div className="field"><label>{t("utrLabel")}</label><input value={utr} onChange={(e) => setUtr(e.target.value)} placeholder="e.g. 412345678901" /></div>
        <div className="field"><label>{t("confirmedByLabel")}</label><input value={by} onChange={(e) => setBy(e.target.value)} placeholder={t("yourName")} /></div>
        <button onClick={async () => {
          setErr(""); setMsg("");
          try { await api.confirmPayment(id, utr.trim(), by.trim() || "staff"); setMsg(t("paymentConfirmed")); onDone(); }
          catch (e) { setErr((e as Error).message); }
        }}>{t("markPaid")}</button>
      </div>
    </div>
  );
}

function Dispatch({ id, onDone, setErr, setOtp, otp }: { id: string; onDone: () => void; setErr: (s: string) => void; setOtp: (s: string) => void; otp: string }) {
  const { t } = useI18n();
  const [route, setRoute] = useState("");
  const [conductor, setConductor] = useState("");
  return (
    <div className="card">
      <h3 style={{ marginTop: 0 }}>{t("dispatchOnBus")}</h3>
      <div className="row">
        <div className="field"><label>{t("busRoute")}</label><input value={route} onChange={(e) => setRoute(e.target.value)} placeholder="Jhansi–Mauranipur" /></div>
        <div className="field"><label>{t("conductor")}</label><input value={conductor} onChange={(e) => setConductor(e.target.value)} /></div>
        <button className="warn" onClick={async () => {
          setErr("");
          try { const r = await api.dispatch(id, route.trim(), conductor.trim()); setOtp(r.otp); onDone(); }
          catch (e) { setErr((e as Error).message); }
        }}>{t("dispatchGenerateOtp")}</button>
      </div>
      {otp && <p style={{ marginTop: 12 }}>{t("giveOtp")}<br /><span className="otp">{otp}</span></p>}
    </div>
  );
}

function DeliverForm({ id, onDone, setErr, setMsg }: { id: string; onDone: () => void; setErr: (s: string) => void; setMsg: (s: string) => void }) {
  const { t } = useI18n();
  const [otp, setOtp] = useState("");
  return (
    <div className="row">
      <div className="field"><label>{t("otpFromCustomer")}</label><input value={otp} onChange={(e) => setOtp(e.target.value)} /></div>
      <button onClick={async () => {
        setErr(""); setMsg("");
        try { const r = await api.deliver(id, otp.trim()); setMsg(r.cashbackPaise > 0 ? t("deliveredCashback", { amt: rupees(r.cashbackPaise) }) : t("deliveredOk")); onDone(); }
        catch (e) { setErr((e as Error).message); }
      }}>{t("confirmDelivered")}</button>
    </div>
  );
}
