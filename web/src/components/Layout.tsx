import { NavLink, Outlet, useNavigate } from "react-router-dom";
import { useI18n } from "../i18n";
import { useAuth } from "../auth";
import { ThemeSwitcher } from "../theme";

const link = ({ isActive }: { isActive: boolean }) => (isActive ? "active" : "");

export function Layout() {
  const { t, lang, setLang } = useI18n();
  const { user, shops, selectedShop, selectShop, logout } = useAuth();
  const navigate = useNavigate();
  const isSuper = user?.role === "SUPER_ADMIN";

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
          {isSuper && <NavLink to="/shops" className={link}>{t("nav.shops")}</NavLink>}
        </nav>

        <div className="sidebar-foot">
          {isSuper ? (
            <select
              className="shopswitch"
              value={selectedShop}
              onChange={(e) => { selectShop(e.target.value); navigate(0); }}
            >
              <option value="">{t("allShops")}</option>
              {shops.map((s) => <option key={s.id} value={s.id}>{s.name}</option>)}
            </select>
          ) : (
            <div className="shopname">{user?.shopName}</div>
          )}
          <div className="whoami">{user?.name || user?.email} · {user?.role}</div>
          <ThemeSwitcher label={t("theme")} />
          <button className="secondary logout" onClick={logout}>{t("logout")}</button>
        </div>
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
