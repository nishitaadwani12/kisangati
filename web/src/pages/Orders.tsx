import { useEffect, useState } from "react";
import { Link } from "react-router-dom";
import { api, Order } from "../api";
import { rupees, when } from "../format";
import { Badge } from "../components/Layout";
import { useI18n } from "../i18n";

const STATUSES = ["", "RECEIVED", "QUOTED", "PAID", "PACKED", "DISPATCHED", "DELIVERED", "CANCELLED"];

export function Orders() {
  const { t } = useI18n();
  const [orders, setOrders] = useState<Order[]>([]);
  const [status, setStatus] = useState("");
  const [err, setErr] = useState("");

  const load = () => api.orders(status || undefined).then(setOrders).catch((e) => setErr(e.message));
  useEffect(() => { load(); /* eslint-disable-next-line */ }, [status]);

  return (
    <div>
      <div className="spread">
        <h2>{t("orders")}</h2>
        <div className="field">
          <label>{t("filterByStatus")}</label>
          <select value={status} onChange={(e) => setStatus(e.target.value)}>
            {STATUSES.map((s) => <option key={s} value={s}>{s ? t(`status.${s}`) : t("all")}</option>)}
          </select>
        </div>
      </div>
      {err && <div className="err">{err}</div>}
      <div className="card">
        <table>
          <thead>
            <tr><th>{t("created")}</th><th>{t("customer")}</th><th>{t("source")}</th><th>{t("summary")}</th><th>{t("total")}</th><th>{t("status")}</th></tr>
          </thead>
          <tbody>
            {orders.map((o) => (
              <tr key={o.id}>
                <td className="muted">{when(o.createdAt)}</td>
                <td>{o.user.name || o.user.phone}<br /><span className="muted">{t(`type.${o.user.userType}`)}</span></td>
                <td><span className="pill">{o.orderSource}</span></td>
                <td><Link to={`/orders/${o.id}`}>{o.rawText || t("nItems", { n: o.items.length })}</Link></td>
                <td>{o.total > 0 ? rupees(o.total) : "—"}</td>
                <td><Badge status={o.status} /></td>
              </tr>
            ))}
            {orders.length === 0 && <tr><td colSpan={6} className="muted">{t("noOrders")}</td></tr>}
          </tbody>
        </table>
      </div>
    </div>
  );
}
