import { api } from "./api";

export async function fetchPaymentConfig(): Promise<{ razorpay_enabled: boolean; razorpay_key_id: string | null }> {
  const r = await fetch(`${process.env.EXPO_PUBLIC_BACKEND_URL}/api/payments/config`);
  return r.json();
}

export async function verifyRazorpay(orderId: string, resp: { razorpay_order_id: string; razorpay_payment_id: string; razorpay_signature: string }) {
  const t = await (await import("./storage")).storage.get("db_token");
  const r = await fetch(`${process.env.EXPO_PUBLIC_BACKEND_URL}/api/payments/razorpay/verify`, {
    method: "POST",
    headers: { "Content-Type": "application/json", Authorization: `Bearer ${t}` },
    body: JSON.stringify({ order_id: orderId, ...resp }),
  });
  if (!r.ok) throw new Error((await r.json()).detail || "Verify failed");
  return r.json();
}
