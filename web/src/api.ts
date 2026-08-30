// Thin API client for the KisanGati backend. All money is in paise.

async function req<T>(path: string, method = "GET", body?: unknown): Promise<T> {
  const res = await fetch(`/api${path}`, {
    method,
    headers: body ? { "Content-Type": "application/json" } : undefined,
    body: body ? JSON.stringify(body) : undefined,
  });
  const data = await res.json().catch(() => ({}));
  if (!res.ok) throw new Error((data as { error?: string }).error || `Request failed (${res.status})`);
  return data as T;
}

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
  wholesalePrice: number;
  weightG: number;
  stockQty: number;
};

export type OrderItem = { id: string; skuId: string; qty: number; unitPrice: number; sku?: Sku };
export type Payment = { status: string; method: string; utr: string | null; confirmedBy: string | null; amount: number };
export type Delivery = { busRoute: string | null; conductorName: string | null; dispatchedAt: string | null; claimedAt: string | null };

export type Order = {
  id: string;
  orderSource: string;
  status: string;
  rawText: string | null;
  mediaUrl: string | null;
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
    req<{ otp: string }>(`/orders/${id}/dispatch`, "POST", { busRoute, conductorName }),
  deliver: (id: string, otp: string) => req<{ cashbackPaise: number }>(`/orders/${id}/deliver`, "POST", { otp }),

  skus: (q?: string) => req<Sku[]>(`/skus${q ? `?q=${encodeURIComponent(q)}` : ""}`),
  createSku: (b: Partial<Sku> & { name: string; retailPrice: number }) => req<Sku>("/skus", "POST", b),
  patchSku: (id: string, b: Partial<Sku>) => req<Sku>(`/skus/${id}`, "PATCH", b),

  customers: (q?: string) => req<Customer[]>(`/customers${q ? `?q=${encodeURIComponent(q)}` : ""}`),
  createCustomer: (b: { phone: string; name?: string; userType: string; acquisitionChannel: string }) =>
    req<Customer>("/customers", "POST", b),

  today: () => req<TodayStats>("/stats/today"),
};
