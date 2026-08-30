import { useEffect, useState } from "react";
import { Link } from "react-router-dom";
import { api, Order } from "../api";
import { rupees, when } from "../format";
import { Badge } from "../components/Layout";

const STATUSES = ["", "RECEIVED", "QUOTED", "PAID", "PACKED", "DISPATCHED", "DELIVERED", "CANCELLED"];

export function Orders() {
  const [orders, setOrders] = useState<Order[]>([]);
  const [status, setStatus] = useState("");
  const [err, setErr] = useState("");

  const load = () => api.orders(status || undefined).then(setOrders).catch((e) => setErr(e.message));
  useEffect(() => { load(); /* eslint-disable-next-line */ }, [status]);

  return (
    <div>
      <div className="spread">
        <h2>Orders</h2>
        <div className="field">
          <label>Filter by status</label>
          <select value={status} onChange={(e) => setStatus(e.target.value)}>
            {STATUSES.map((s) => <option key={s} value={s}>{s || "All"}</option>)}
          </select>
        </div>
      </div>
      {err && <div className="err">{err}</div>}
      <div className="card">
        <table>
          <thead>
            <tr><th>Created</th><th>Customer</th><th>Source</th><th>Summary</th><th>Total</th><th>Status</th></tr>
          </thead>
          <tbody>
            {orders.map((o) => (
              <tr key={o.id}>
                <td className="muted">{when(o.createdAt)}</td>
                <td>{o.user.name || o.user.phone}<br /><span className="muted">{o.user.userType}</span></td>
                <td><span className="pill">{o.orderSource}</span></td>
                <td><Link to={`/orders/${o.id}`}>{o.rawText || `${o.items.length} item(s)`}</Link></td>
                <td>{o.total > 0 ? rupees(o.total) : "—"}</td>
                <td><Badge status={o.status} /></td>
              </tr>
            ))}
            {orders.length === 0 && <tr><td colSpan={6} className="muted">No orders.</td></tr>}
          </tbody>
        </table>
      </div>
    </div>
  );
}
