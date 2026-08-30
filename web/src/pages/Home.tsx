import { useEffect, useState } from "react";
import { api, TodayStats } from "../api";
import { rupees } from "../format";
import { useI18n } from "../i18n";

export function Home() {
  const { t } = useI18n();
  const [stats, setStats] = useState<TodayStats | null>(null);
  const [err, setErr] = useState("");

  useEffect(() => {
    api.today().then(setStats).catch((e) => setErr(e.message));
  }, []);

  return (
    <div>
      <h2>{t("today")}</h2>
      {err && <div className="err">{err}</div>}
      {stats && (
        <>
          <div className="row">
            <div className="card" style={{ flex: 1 }}>
              <div className="muted">{t("ordersToday")}</div>
              <div className="stat">{stats.ordersToday}</div>
            </div>
            <div className="card" style={{ flex: 1 }}>
              <div className="muted">{t("confirmedSalesToday")}</div>
              <div className="stat">{rupees(stats.salesTodayPaise)}</div>
            </div>
          </div>
          <div className="card">
            <h3 style={{ marginTop: 0 }}>{t("ordersByStatus")}</h3>
            <div className="row">
              {Object.entries(stats.statusBreakdown).length === 0 && <span className="muted">{t("noOrdersYet")}</span>}
              {Object.entries(stats.statusBreakdown).map(([s, n]) => (
                <span key={s} className="pill">{t(`status.${s}`)}: <strong>{n}</strong></span>
              ))}
            </div>
          </div>
        </>
      )}
    </div>
  );
}
