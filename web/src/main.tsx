import React from "react";
import ReactDOM from "react-dom/client";
import { createBrowserRouter, RouterProvider } from "react-router-dom";
import "./styles.css";
import { LangProvider } from "./i18n";
import { AuthProvider, useAuth } from "./auth";
import { Layout } from "./components/Layout";
import { Login } from "./pages/Login";
import { Home } from "./pages/Home";
import { Orders } from "./pages/Orders";
import { OrderDetail } from "./pages/OrderDetail";
import { Customers } from "./pages/Customers";
import { Mistris } from "./pages/Mistris";
import { Shops } from "./pages/Shops";

const router = createBrowserRouter([
  {
    path: "/",
    element: <Layout />,
    children: [
      { index: true, element: <Home /> },
      { path: "orders", element: <Orders /> },
      { path: "orders/:id", element: <OrderDetail /> },
      { path: "customers", element: <Customers /> },
      { path: "mistris", element: <Mistris /> },
      { path: "shops", element: <Shops /> },
    ],
  },
]);

// Show the login screen until authenticated; then the app.
function Gate() {
  const { ready, token } = useAuth();
  if (!ready) return null;
  return token ? <RouterProvider router={router} /> : <Login />;
}

ReactDOM.createRoot(document.getElementById("root")!).render(
  <React.StrictMode>
    <LangProvider>
      <AuthProvider>
        <Gate />
      </AuthProvider>
    </LangProvider>
  </React.StrictMode>
);
