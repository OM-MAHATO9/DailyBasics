// Web version of RazorpayCheckout. react-native-webview does not run in the
// browser, so on web we load Razorpay's checkout.js into the page and open
// its popup directly. Expo picks this file automatically for web builds.
import { useEffect, useRef } from "react";

type Props = {
  visible: boolean;
  order: {
    id: string;
    order_number: string;
    razorpay_order_id: string;
    razorpay_amount_paise: number;
    razorpay_key_id: string;
  };
  user: { name?: string; email?: string; phone?: string };
  onSuccess: (r: { razorpay_order_id: string; razorpay_payment_id: string; razorpay_signature: string }) => void;
  onFailure: (r: any) => void;
  onDismiss: () => void;
};

const SCRIPT_SRC = "https://checkout.razorpay.com/v1/checkout.js";

function loadScript(): Promise<void> {
  if ((window as any).Razorpay) return Promise.resolve();
  return new Promise((resolve, reject) => {
    const existing = document.querySelector(`script[src="${SCRIPT_SRC}"]`) as HTMLScriptElement | null;
    const s = existing || document.createElement("script");
    s.addEventListener("load", () => resolve());
    s.addEventListener("error", () => reject(new Error("Could not load Razorpay")));
    if (!existing) {
      s.src = SCRIPT_SRC;
      s.async = true;
      document.body.appendChild(s);
    }
  });
}

export default function RazorpayCheckout({ visible, order, user, onSuccess, onFailure, onDismiss }: Props) {
  // Keep the latest callbacks without re-opening the popup on every render.
  const cb = useRef({ onSuccess, onFailure, onDismiss });
  cb.current = { onSuccess, onFailure, onDismiss };

  useEffect(() => {
    if (!visible) return;
    let finished = false;
    let rzp: any = null;
    let lastError: any = null;
    loadScript()
      .then(() => {
        rzp = new (window as any).Razorpay({
          key: order.razorpay_key_id,
          amount: String(order.razorpay_amount_paise),
          currency: "INR",
          name: "DailyBasic",
          description: "Order " + order.order_number,
          order_id: order.razorpay_order_id,
          prefill: { name: user.name || "", email: user.email || "", contact: user.phone || "" },
          theme: { color: "#00452F" },
          modal: {
            ondismiss: () => {
              if (finished) return;
              finished = true;
              if (lastError) cb.current.onFailure(lastError);
              else cb.current.onDismiss();
            },
          },
          handler: (response: any) => {
            finished = true;
            cb.current.onSuccess(response);
          },
        });
        rzp.on("payment.failed", (response: any) => {
          // Razorpay keeps its popup open so the customer can try another
          // method; we only report the failure if they then close it.
          lastError = response?.error || response;
        });
        rzp.open();
      })
      .catch((e) => {
        finished = true;
        cb.current.onFailure({ description: e.message });
      });
    return () => {
      finished = true;
      try { rzp?.close(); } catch {}
    };
  }, [visible, order.razorpay_order_id]);

  return null;
}
