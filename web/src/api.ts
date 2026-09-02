// Thin API client for the KisanGati backend. All money is in paise.

// Append the super-admin's selected shop (if any) so their reads/writes target that shop.
function withShop(path: string): string {
  const shop = localStorage.getItem("kg_shop");
  if (!shop) return path;
  return path + (path.includes("?") ? "&" : "?") + "shopId=" + encodeURIComponent(shop);
}

async function req<T>(path: string, method = "GET", body?: unknown): Promise<T> {
  const token = localStorage.getItem("kg_token");
  const headers: Record<string, string> = {};
  if (body) headers["Content-Type"] = "application/json";
  if (token) headers["Authorization"] = `Bearer ${token}`;
  const res = await fetch(`/api${withShop(path)}`, {
    method,
    headers,
    body: body ? JSON.stringify(body) : undefined,
  });
  if (res.status === 401 && !path.startsWith("/auth/login")) {
    localStorage.removeItem("kg_token");
    if (location.pathname !== "/") location.href = "/";
  }
  const data = await res.json().catch(() => ({}));
  if (!res.ok) throw new Error((data as { error?: string }).error || `Request failed (${res.status})`);
  return data as T;
}

export type MeUser = { id: string; name: string | null; email: string; role: string; shopId: string | null; shopName: string | null };
export type Shop = { id: string; name: string; town: string | null };
export type ShopWithCounts = Shop & { _count: { orders: number; users: number; skus: number } };

export type Customer = {
  id: string;
  phone: string;
  name: string | null;
  userType: "FARMER" | "MISTRI";
  acquisitionChannel: string;
  walletBalance: number;
  _count?: { orders: number };
};

export type Sku = {
  id: string;
  name: string;
  brand: string | null;
  modelCompat: string | null;
  category: string | null;
  retailPrice: number;
  mistriPrice: number | null;
  wholesalePrice: number;
  weightG: number;
  stockQty: number;
};

export type OrderItem = { id: string; skuId: string; qty: number; unitPrice: number; sku?: Sku };
export type Payment = { status: string; method: string; utr: string | null; confirmedBy: string | null; amount: number; refundStatus: string | null; refundUtr: string | null; refundedBy: string | null };
export type WalletTxn = { id: string; type: string; amount: number; ref: string | null; createdAt: string };
export type Delivery = { busRoute: string | null; conductorName: string | null; dispatchedAt: string | null; claimedAt: string | null };

export type Order = {
  id: string;
  orderSource: string;
  status: string;
  rawText: string | null;
  mediaUrl: string | null;
  media?: { id: string; url: string; kind: string }[];
  tractorBrand: string | null;
  model: string | null;
  subtotal: number;
  deliveryFee: number;
  total: number;
  createdAt: string;
  user: Customer;
  items: OrderItem[];
  payment: Payment | null;
  delivery: Delivery | null;
};

export type TodayStats = { ordersToday: number; salesTodayPaise: number; statusBreakdown: Record<string, number> };

export const api = {
  login: (email: string, password: string) =>
    req<{ token: string; user: MeUser }>("/auth/login", "POST", { email, password }),
  me: () => req<{ user: MeUser; shops: Shop[] }>("/auth/me"),

  orders: (status?: string) => req<Order[]>(`/orders${status ? `?status=${status}` : ""}`),
  order: (id: string) => req<Order>(`/orders/${id}`),
  createOrder: (b: { userId: string; orderSource?: string; rawText?: string; tractorBrand?: string; model?: string }) =>
    req<Order>("/orders", "POST", b),
  setItems: (id: string, items: { skuId: string; qty: number; unitPrice: number }[]) =>
    req<Order>(`/orders/${id}/items`, "POST", { items }),
  quote: (id: string) => req<{ upiLink: string; totalPaise: number }>(`/orders/${id}/quote`, "POST", {}),
  confirmPayment: (id: string, utr: string, confirmedBy: string) =>
    req<{ status: string }>(`/orders/${id}/payment/confirm`, "POST", { utr, confirmedBy }),
  dispatch: (id: string, busRoute: string, conductorName: string) =>
    req<{ status: string; busRoute: string; conductorName: string }>(`/orders/${id}/dispatch`, "POST", { busRoute, conductorName }),
  deliver: (id: string) => req<{ cashbackPaise: number }>(`/orders/${id}/deliver`, "POST", {}),
  cancelOrder: (id: string, reason: string) =>
    req<{ status: string; refundDue: boolean; refundAmountPaise: number }>(`/orders/${id}/cancel`, "POST", { reason }),
  refundOrder: (id: string, utr: string, refundedBy: string) =>
    req<{ refundStatus: string }>(`/orders/${id}/refund`, "POST", { utr, refundedBy }),

  skus: (q?: string) => req<Sku[]>(`/skus${q ? `?q=${encodeURIComponent(q)}` : ""}`),
  createSku: (b: Partial<Sku> & { name: string; retailPrice: number }) => req<Sku>("/skus", "POST", b),
  patchSku: (id: string, b: Partial<Sku>) => req<Sku>(`/skus/${id}`, "PATCH", b),

  shops: () => req<ShopWithCounts[]>("/shops"),
  createShop: (b: { shopName: string; town?: string; ownerEmail: string; ownerName?: string; password: string }) =>
    req<{ shop: Shop }>("/shops", "POST", b),

  customers: (q?: string) => req<Customer[]>(`/customers${q ? `?q=${encodeURIComponent(q)}` : ""}`),
  createCustomer: (b: { phone: string; name?: string; userType: string; acquisitionChannel: string }) =>
    req<Customer>("/customers", "POST", b),
  wallet: (id: string) => req<{ balance: number; txns: WalletTxn[] }>(`/customers/${id}/wallet`),
  payout: (id: string, utr: string) => req<{ paidOutPaise: number; balance: number }>(`/customers/${id}/payout`, "POST", { utr }),

  today: () => req<TodayStats>("/stats/today"),
};
