import { useEffect, useState } from "react";
import { useParams, Link } from "react-router-dom";
import { api, Order, Sku } from "../api";
import { rupees, rupeesToPaise, when, suggestedPricePaise } from "../format";
import { Badge } from "../components/Layout";

type Line = { skuId: string; name: string; qty: number; unitPriceRupees: number };

export function OrderDetail() {
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

  if (!order) return <div>{err ? <div className="err">{err}</div> : "Loading…"}</div>;

  const editable = order.status === "RECEIVED" || order.status === "QUOTED";
  const addLine = (skuId: string) => {
    const s = skus.find((x) => x.id === skuId);
    if (!s) return;
    // Default the unit price by the customer's type (farmer vs mistri). Staff can still override.
    const price = suggestedPricePaise(s, order.user.userType);
    setLines([...lines, { skuId: s.id, name: s.name, qty: 1, unitPriceRupees: price / 100 }]);
  };
  const saveItems = () =>
    act(() => api.setItems(id, lines.map((l) => ({ skuId: l.skuId, qty: l.qty, unitPrice: rupeesToPaise(l.unitPriceRupees) }))), "Items saved");

  return (
    <div>
      <div className="spread">
        <h2><Link to="/orders">Orders</Link> / {order.id.slice(-6)}</h2>
        <Badge status={order.status} />
      </div>
      {err && <div className="err">{err}</div>}
      {msg && <div className="ok">{msg}</div>}

      <div className="card">
        <div className="spread">
          <div>
            <strong>{order.user.name || order.user.phone}</strong> <span className="muted">({order.user.userType})</span><br />
            <span className="muted">{order.user.phone} · via {order.orderSource} · {when(order.createdAt)}</span>
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
        <h3 style={{ marginTop: 0 }}>Parts &amp; price</h3>
        <table>
          <thead><tr><th>Part</th><th>Qty</th><th>Unit ₹</th><th>Line</th>{editable && <th></th>}</tr></thead>
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
            {lines.length === 0 && <tr><td colSpan={5} className="muted">No parts matched yet.</td></tr>}
          </tbody>
        </table>
        {editable && (
          <div className="row" style={{ marginTop: 10 }}>
            <select defaultValue="" onChange={(e) => { addLine(e.target.value); e.currentTarget.value = ""; }}>
              <option value="" disabled>+ add part…</option>
              {skus.map((s) => <option key={s.id} value={s.id}>{s.name} {s.brand ? `(${s.brand})` : ""} — {rupees(suggestedPricePaise(s, order.user.userType))}</option>)}
            </select>
            <button onClick={saveItems} disabled={lines.length === 0}>Save items</button>
            <span className="muted">Prices shown are the {order.user.userType === "MISTRI" ? "mistri" : "farmer"} rate.</span>
          </div>
        )}
        <div className="spread" style={{ marginTop: 12 }}>
          <span className="muted">Subtotal {rupees(order.subtotal)} + delivery {rupees(order.deliveryFee)}</span>
          <strong>Total {rupees(order.total)}</strong>
        </div>
      </div>

      {/* Workflow actions by status */}
      {(order.status === "RECEIVED" || order.status === "QUOTED") && order.total > 0 && (
        <div className="card">
          <h3 style={{ marginTop: 0 }}>Quote &amp; UPI</h3>
          <button onClick={() => act(async () => { const r = await api.quote(id); setUpiLink(r.upiLink); }, "Quote sent — share the UPI QR")}>
            Generate UPI link / QR
          </button>
          {upiLink && <p style={{ marginTop: 10 }}>Send this to the customer: <br /><code>{upiLink}</code></p>}
        </div>
      )}

      {order.status === "QUOTED" && <ConfirmPayment id={id} onDone={load} setErr={setErr} setMsg={setMsg} />}

      {order.status === "PAID" && <Dispatch id={id} onDone={load} setErr={setErr} setOtp={setOtp} otp={otp} />}

      {order.status === "DISPATCHED" && (
        <div className="card">
          <h3 style={{ marginTop: 0 }}>Confirm delivery (OTP)</h3>
          {order.delivery && <p className="muted">On bus {order.delivery.busRoute} · conductor {order.delivery.conductorName}</p>}
          <DeliverForm id={id} onDone={load} setErr={setErr} setMsg={setMsg} />
        </div>
      )}

      {order.payment && (
        <div className="card">
          <h3 style={{ marginTop: 0 }}>Payment</h3>
          <p className="muted">
            {order.payment.method} · {order.payment.status}
            {order.payment.utr && <> · UTR <code>{order.payment.utr}</code></>}
            {order.payment.confirmedBy && <> · by {order.payment.confirmedBy}</>}
          </p>
        </div>
      )}
    </div>
  );
}

function ConfirmPayment({ id, onDone, setErr, setMsg }: { id: string; onDone: () => void; setErr: (s: string) => void; setMsg: (s: string) => void }) {
  const [utr, setUtr] = useState("");
  const [by, setBy] = useState("");
  return (
    <div className="card">
      <h3 style={{ marginTop: 0 }}>Confirm payment received</h3>
      <p className="muted">Verify the amount actually landed in your UPI app, then enter the UPI reference (UTR). A screenshot is not proof.</p>
      <div className="row">
        <div className="field"><label>UTR / UPI ref</label><input value={utr} onChange={(e) => setUtr(e.target.value)} placeholder="e.g. 412345678901" /></div>
        <div className="field"><label>Confirmed by</label><input value={by} onChange={(e) => setBy(e.target.value)} placeholder="your name" /></div>
        <button onClick={async () => {
          setErr(""); setMsg("");
          try { await api.confirmPayment(id, utr.trim(), by.trim() || "staff"); setMsg("Payment confirmed"); onDone(); }
          catch (e) { setErr((e as Error).message); }
        }}>Mark paid</button>
      </div>
    </div>
  );
}

function Dispatch({ id, onDone, setErr, setOtp, otp }: { id: string; onDone: () => void; setErr: (s: string) => void; setOtp: (s: string) => void; otp: string }) {
  const [route, setRoute] = useState("");
  const [conductor, setConductor] = useState("");
  return (
    <div className="card">
      <h3 style={{ marginTop: 0 }}>Dispatch on bus</h3>
      <div className="row">
        <div className="field"><label>Bus route</label><input value={route} onChange={(e) => setRoute(e.target.value)} placeholder="Jhansi–Mauranipur" /></div>
        <div className="field"><label>Conductor</label><input value={conductor} onChange={(e) => setConductor(e.target.value)} /></div>
        <button className="warn" onClick={async () => {
          setErr("");
          try { const r = await api.dispatch(id, route.trim(), conductor.trim()); setOtp(r.otp); onDone(); }
          catch (e) { setErr((e as Error).message); }
        }}>Dispatch &amp; generate OTP</button>
      </div>
      {otp && <p style={{ marginTop: 12 }}>Give this OTP to the customer (they show it at the bus stop):<br /><span className="otp">{otp}</span></p>}
    </div>
  );
}

function DeliverForm({ id, onDone, setErr, setMsg }: { id: string; onDone: () => void; setErr: (s: string) => void; setMsg: (s: string) => void }) {
  const [otp, setOtp] = useState("");
  return (
    <div className="row">
      <div className="field"><label>OTP from customer</label><input value={otp} onChange={(e) => setOtp(e.target.value)} /></div>
      <button onClick={async () => {
        setErr(""); setMsg("");
        try { const r = await api.deliver(id, otp.trim()); setMsg(r.cashbackPaise > 0 ? `Delivered ✓ · mistri cashback ${rupees(r.cashbackPaise)}` : "Delivered ✓"); onDone(); }
        catch (e) { setErr((e as Error).message); }
      }}>Confirm delivered</button>
    </div>
  );
}
