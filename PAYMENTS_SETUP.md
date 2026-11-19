# Online payments (Razorpay) setup

Online payment (UPI / cards / netbanking) turns on automatically once the backend has Razorpay keys. Until then, customers only see Cash on Delivery.

## 1. Get your keys
1. Sign up at https://dashboard.razorpay.com and finish KYC (needed for Live mode).
2. Go to **Account & Settings → API Keys** and generate a key.
   - Use **Test mode** keys (`rzp_test_...`) first to try it with test cards/UPI.
   - Switch to **Live mode** keys (`rzp_live_...`) when you're ready to take real money.

## 2. Add them to the backend
Set these environment variables where the backend runs (your hosting provider's environment settings, or `backend/.env`). **Never commit them to GitHub.**

```
RAZORPAY_KEY_ID=rzp_test_xxxxxxxxxxxx
RAZORPAY_KEY_SECRET=xxxxxxxxxxxxxxxxxxxx
RAZORPAY_WEBHOOK_SECRET=any-long-random-string
```

Restart the backend. The "UPI / Card / Netbanking" option now appears at checkout.

## 3. Add the webhook (recommended)
The webhook confirms payments even if the customer closes the app right after paying.

1. Razorpay dashboard → **Account & Settings → Webhooks → Add New Webhook**.
2. URL: `https://<your-backend-address>/api/payments/razorpay/webhook`
3. Secret: the same value as `RAZORPAY_WEBHOOK_SECRET`.
4. Events: `payment.captured`, `payment.failed`, `order.paid`.

## How it works
- Customer picks online payment → order is created → Razorpay popup opens (works on web, Android and iOS).
- Payment success → backend verifies Razorpay's signature → order becomes **Paid** and **Confirmed**, and the WhatsApp confirmation is sent.
- Payment failed or popup closed → the customer lands on the order page with a **Pay Now** button to try again. Before a retry, the backend checks with Razorpay that the earlier attempt wasn't already paid, so nobody pays twice.
- A paid online order that gets cancelled is refunded automatically to the customer's card/UPI. If the refund fails, the order shows `refund_failed`. Refund it by hand from the Razorpay dashboard.

## API reference
| Step | Endpoint | Notes |
|---|---|---|
| Create order | `POST /api/orders` with `payment_method: "online"` | Saves the order, creates the Razorpay order and returns `razorpay_order_id`, `razorpay_amount_paise` and `razorpay_key_id`. Minimum ₹1 (100 paise). |
| Retry payment | `POST /api/payments/razorpay/retry/{order_id}` | New Razorpay order for an unpaid order. |
| Verify payment | `POST /api/payments/razorpay/verify` | Body: `order_id`, `razorpay_order_id`, `razorpay_payment_id`, `razorpay_signature`. Checks HMAC-SHA256(`order_id|payment_id`, KEY_SECRET). |
| Webhook | `POST /api/payments/razorpay/webhook` | Backup confirmation from Razorpay. |

Error codes: `400` for a missing field, a bad signature (the order is **not** marked paid) or an amount under ₹1. `401` if Razorpay rejects the server's keys. `500` for any other Razorpay error.
