import { createContext, useContext, useEffect, useState, ReactNode } from "react";
import { api, MeUser, Shop } from "./api";

type Ctx = {
  ready: boolean;
  token: string | null;
  user: MeUser | null;
  shops: Shop[]; // for super-admin shop switcher
  selectedShop: string; // super-admin's chosen shop id (or "")
  login: (email: string, password: string) => Promise<void>;
  logout: () => void;
  selectShop: (shopId: string) => void;
};

const AuthContext = createContext<Ctx>({} as Ctx);

export function AuthProvider({ children }: { children: ReactNode }) {
  const [ready, setReady] = useState(false);
  const [token, setToken] = useState<string | null>(localStorage.getItem("kg_token"));
  const [user, setUser] = useState<MeUser | null>(null);
  const [shops, setShops] = useState<Shop[]>([]);
  const [selectedShop, setSelectedShop] = useState(localStorage.getItem("kg_shop") || "");

  useEffect(() => {
    if (!token) { setReady(true); return; }
    api.me()
      .then((r) => { setUser(r.user); setShops(r.shops); })
      .catch(() => { localStorage.removeItem("kg_token"); setToken(null); })
      .finally(() => setReady(true));
  }, [token]);

  const login = async (email: string, password: string) => {
    const r = await api.login(email, password);
    localStorage.setItem("kg_token", r.token);
    setToken(r.token);
    setUser(r.user);
  };
  const logout = () => {
    localStorage.removeItem("kg_token"); localStorage.removeItem("kg_shop");
    setToken(null); setUser(null); setShops([]); setSelectedShop("");
  };
  const selectShop = (shopId: string) => {
    if (shopId) localStorage.setItem("kg_shop", shopId); else localStorage.removeItem("kg_shop");
    setSelectedShop(shopId);
  };

  return (
    <AuthContext.Provider value={{ ready, token, user, shops, selectedShop, login, logout, selectShop }}>
      {children}
    </AuthContext.Provider>
  );
}

export const useAuth = () => useContext(AuthContext);
