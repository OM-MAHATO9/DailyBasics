# DailyBasics — Product Requirements Document

## 1. Product Summary
DailyBasics is a mobile-first hyperlocal grocery + ready-to-eat food delivery app tailored for rural Indian villages and small towns. Modelled after modern quick-commerce UX but designed for first-time online buyers: large touch targets, high-contrast saffron/orange theme, clear MRP + selling price + discount %, Hindi keyword search, and simple COD flow.

The app ships **three role-based interfaces in a single Expo bundle**:
1. **Customer** — Phone + OTP login, browses food and daily essentials, orders with COD.
2. **Delivery Partner** — Phone + OTP login, receives assigned orders, delivers with 4-digit customer OTP.
3. **Admin / Store Owner** — Email + Password login, manages orders, inventory, partners, and analytics.

## 2. Tech Stack
- **Frontend**: Expo SDK 54, React Native, Expo Router (file-based), TypeScript.
- **Backend**: FastAPI (single `server.py`), Motor (async MongoDB), JWT (PyJWT) + bcrypt.
- **DB**: MongoDB (`dailybasics`).
- **State**: Local storage (AsyncStorage + SecureStore abstraction) for token + cart persistence.
- **Theme**: Saffron/Deep Orange `#E65100` primary, chunky cards, 48pt+ tap targets.

## 3. Sections & Categories
Products are grouped into 3 top-level sections with 19 seeded categories:
- **Food (ready-to-serve)** — Ready Meals, Snacks & Chaat, Breakfast, Sweets
- **Daily Essentials** — Fruits & Vegetables, Dairy & Milk, Bread & Bakery, Rice & Atta, Dal & Pulses, Oil & Ghee, Spices & Masala, Beverages, Tea & Coffee, Biscuits
- **Others** — Personal Care, Household Cleaning, Baby Care, Pooja Items, Stationery

## 4. Core Flows (Implemented)
- OTP-based signup/login (mock OTP surfaced in-app; abstraction ready for Twilio/MSG91 swap-in).
- Home with section switcher, category grid, promo banner, "Today's Offers", "Best Sellers", "Recommended".
- Search with Hindi keyword support (`आटा`, `दूध`, `चावल`) and sort by relevance / price / popularity.
- Product detail with MRP strike-through + selling price + discount % + stock check.
- Cart with quantity steppers, savings banner, persistent between sessions.
- Address CRUD with village/landmark/pincode/phone/instructions.
- Delivery-zone check by pincode: serviceable zones (110001-3 Zone A ₹10, 201301-2 & 221001 Zone B ₹20).
- Coupons (`WELCOME50`, `SAVE20`, `FREEDEL`).
- Order placement (COD; UPI stub as "coming soon").
- Order tracking with vertical stepper (Placed → Confirmed → Preparing → Packed → Out for Delivery → Delivered).
- Delivery partner: online toggle, active/delivered lists, one-tap advance with 4-digit customer OTP and cash-collection input.
- Admin dashboard: today/week/month revenue, pending/completed/cancelled counts, active partners, low-stock products, top sellers.
- Admin: orders list with status filters, order detail with partner assignment + status advancement, product list with low-stock highlight, partner management (add + enable/disable).
- Inventory: auto-decrement on order placement, auto-restore on cancellation.
- RBAC: customers see only own orders; partners only assigned; admin sees all.

## 5. Demo Data (Seeded)
- 1 admin, 5 customers, 3 delivery partners.
- 52 products with real Indian brands (Amul, Aashirvaad, Fortune, Tata, Parle-G, MDH, Britannia…), realistic INR pricing, Unsplash imagery.
- 19 categories, 3 coupons, 2 delivery zones.

## 6. Test Credentials (in `/app/memory/test_credentials.md`)
- **Admin**: `admin@dailybasics.in` / `Admin@123`
- **Customer**: phone `9999900001` (OTP shown in-app after request)
- **Delivery Partner**: phone `9888800001` (OTP shown in-app after request)

## 7. Ready to Extend
- **SMS OTP**: `messaging.py` has a clean provider abstraction with **mock (default)**, **Twilio**, and **MSG91** implementations. Set `SMS_PROVIDER=twilio` (with `TWILIO_ACCOUNT_SID`+`TWILIO_AUTH_TOKEN`) or `SMS_PROVIDER=msg91` (with `MSG91_AUTH_KEY`+`MSG91_SENDER_ID`+`MSG91_TEMPLATE_ID`) in `.env` and real SMS sending activates. Keep `DEV_MOCK_OTP=false` in production so the code isn't surfaced in the API response.
- **Razorpay Online Payments**: fully wired for UPI + Cards + Netbanking. Set `RAZORPAY_KEY_ID` and `RAZORPAY_KEY_SECRET` in `.env` and the "UPI / Card / Netbanking" option activates.
- **WhatsApp Order Updates**: `messaging.py` has both **Twilio WhatsApp** and **Meta Cloud API** providers. Templates for order confirmation, out-for-delivery (with delivery-OTP + partner phone), delivered, and referral reward are already defined. Set `WHATSAPP_PROVIDER=twilio|meta` to enable. Send is fire-and-forget so order flow never blocks or fails on WhatsApp errors.
- **Referral Rewards (Live)**: Every customer auto-gets a 6-char share code (e.g. `RAM897`). New customers can enter a referral code at signup. When their **first non-cancelled delivered order** meets `REFERRAL_MIN_ORDER` (default ₹299), both the referrer and referee get `REFERRAL_REWARD_AMOUNT` (default ₹50) credited to a wallet. Wallet balance can be toggled at checkout to auto-apply as a discount (leaves ≥ ₹1 payable). Cancelled orders refund the wallet-applied amount.
- **Multi-store / multi-village**: `delivery_zones` collection is already the boundary; add `store_id` field to products.
- **Hindi UI localization**: strings are already isolated in components, ready for `expo-localization` layer.
