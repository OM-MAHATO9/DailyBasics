import { storage } from "./storage";

const API = process.env.EXPO_PUBLIC_BACKEND_URL;
const TOKEN_KEY = "db_token";
const USER_KEY = "db_user";

export type Role = "customer" | "delivery_partner" | "admin";

export interface User {
  id: string;
  role: Role;
  name?: string;
  phone?: string;
  email?: string;
}

async function req<T = any>(path: string, opts: RequestInit = {}, auth = false): Promise<T> {
  const headers: Record<string, string> = { "Content-Type": "application/json", ...(opts.headers as any) };
  if (auth) {
    const t = await storage.get(TOKEN_KEY);
    if (t) headers.Authorization = `Bearer ${t}`;
  }
  const res = await fetch(`${API}${path}`, { ...opts, headers });
  const data = await res.json().catch(() => ({}));
  if (!res.ok) {
    const err: any = new Error(data?.detail || data?.message || "Request failed");
    err.status = res.status;
    throw err;
  }
  return data as T;
}

export const api = {
  // Auth
  requestOtp: (phone: string, role: Exclude<Role, "admin">) =>
    req<{ message: string; mock_otp?: string }>("/api/auth/otp/request", {
      method: "POST",
      body: JSON.stringify({ phone, role }),
    }),
  verifyOtp: (phone: string, code: string, role: Exclude<Role, "admin">, name?: string) =>
    req<{ access_token: string; role: Role; user: User }>("/api/auth/otp/verify", {
      method: "POST",
      body: JSON.stringify({ phone, code, role, name }),
    }),
  adminLogin: (email: string, password: string) =>
    req<{ access_token: string; role: Role; user: User }>("/api/auth/admin/login", {
      method: "POST",
      body: JSON.stringify({ email, password }),
    }),
  me: () => req<User>("/api/auth/me", {}, true),

  // Public
  categories: (section?: string) =>
    req<any[]>(`/api/categories${section ? `?section=${section}` : ""}`),
  products: (params: Record<string, any> = {}) => {
    const qs = Object.entries(params)
      .filter(([, v]) => v !== undefined && v !== null && v !== "")
      .map(([k, v]) => `${k}=${encodeURIComponent(String(v))}`)
      .join("&");
    return req<any[]>(`/api/products${qs ? `?${qs}` : ""}`);
  },
  product: (id: string) => req<any>(`/api/products/${id}`),
  checkDelivery: (pin: string) => req<any>(`/api/delivery/check/${pin}`),

  // Customer
  addresses: () => req<any[]>("/api/addresses", {}, true),
  addAddress: (body: any) => req<any>("/api/addresses", { method: "POST", body: JSON.stringify(body) }, true),
  deleteAddress: (id: string) => req<any>(`/api/addresses/${id}`, { method: "DELETE" }, true),
  applyCoupon: (code: string, subtotal: number) =>
    req<any>("/api/coupons/apply", { method: "POST", body: JSON.stringify({ code, subtotal }) }, true),
  placeOrder: (body: any) => req<any>("/api/orders", { method: "POST", body: JSON.stringify(body) }, true),
  orders: (statusFilter?: string) =>
    req<any[]>(`/api/orders${statusFilter ? `?status=${statusFilter}` : ""}`, {}, true),
  order: (id: string) => req<any>(`/api/orders/${id}`, {}, true),
  updateOrderStatus: (id: string, body: any) =>
    req<any>(`/api/orders/${id}/status`, { method: "PATCH", body: JSON.stringify(body) }, true),

  // Admin
  adminStats: () => req<any>("/api/admin/stats", {}, true),
  adminOrders: (statusFilter?: string) =>
    req<any[]>(`/api/admin/orders${statusFilter ? `?status=${statusFilter}` : ""}`, {}, true),
  adminPartners: () => req<any[]>("/api/admin/partners", {}, true),
  assignPartner: (orderId: string, partnerId: string) =>
    req<any>(`/api/orders/${orderId}/assign`, {
      method: "POST",
      body: JSON.stringify({ delivery_partner_id: partnerId }),
    }, true),
  addPartner: (phone: string, name: string) =>
    req<any>("/api/admin/partners", { method: "POST", body: JSON.stringify({ phone, name }) }, true),
  togglePartner: (id: string, is_active: boolean) =>
    req<any>(`/api/admin/partners/${id}`, { method: "PATCH", body: JSON.stringify({ is_active }) }, true),
  adminCustomers: () => req<any[]>("/api/admin/customers", {}, true),
};

export const auth = {
  async save(token: string, user: User) {
    await storage.set(TOKEN_KEY, token);
    await storage.set(USER_KEY, JSON.stringify(user));
  },
  async getUser(): Promise<User | null> {
    const s = await storage.get(USER_KEY);
    return s ? JSON.parse(s) : null;
  },
  async getToken() {
    return storage.get(TOKEN_KEY);
  },
  async clear() {
    await storage.remove(TOKEN_KEY);
    await storage.remove(USER_KEY);
  },
};
