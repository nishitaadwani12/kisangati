import { NavLink, Outlet } from "react-router-dom";

const link = ({ isActive }: { isActive: boolean }) => (isActive ? "active" : "");

export function Layout() {
  return (
    <div className="app">
      <aside className="sidebar">
        <h1>KisanGati</h1>
        <div className="tag">Admin dashboard</div>
        <nav>
          <NavLink to="/" end className={link}>Home</NavLink>
          <NavLink to="/orders" className={link}>Orders</NavLink>
          <NavLink to="/catalog" className={link}>Catalog</NavLink>
          <NavLink to="/customers" className={link}>Customers</NavLink>
        </nav>
      </aside>
      <main className="main">
        <Outlet />
      </main>
    </div>
  );
}

export function Badge({ status }: { status: string }) {
  return <span className={`badge b-${status}`}>{status}</span>;
}
