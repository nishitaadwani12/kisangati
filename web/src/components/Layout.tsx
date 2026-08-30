import { NavLink, Outlet } from "react-router-dom";
import { useI18n } from "../i18n";

const link = ({ isActive }: { isActive: boolean }) => (isActive ? "active" : "");

export function Layout() {
  const { t, lang, setLang } = useI18n();
  return (
    <div className="app">
      <aside className="sidebar">
        <h1>KisanGati</h1>
        <div className="tag">{t("adminDashboard")}</div>
        <div className="langtoggle">
          <button className={lang === "hi" ? "on" : ""} onClick={() => setLang("hi")}>हिं</button>
          <button className={lang === "en" ? "on" : ""} onClick={() => setLang("en")}>EN</button>
        </div>
        <nav>
          <NavLink to="/" end className={link}>{t("nav.home")}</NavLink>
          <NavLink to="/orders" className={link}>{t("nav.orders")}</NavLink>
          <NavLink to="/catalog" className={link}>{t("nav.catalog")}</NavLink>
          <NavLink to="/customers" className={link}>{t("nav.customers")}</NavLink>
        </nav>
      </aside>
      <main className="main">
        <Outlet />
      </main>
    </div>
  );
}

export function Badge({ status }: { status: string }) {
  const { t } = useI18n();
  return <span className={`badge b-${status}`}>{t(`status.${status}`)}</span>;
}
