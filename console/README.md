# Food Market Console

The DailyBasics admin console. It talks to the same backend as the customer app, so orders, menu, payments and delivery areas are always in sync.

| Page | What you can do |
|---|---|
| Dashboard | Revenue today / 7 / 30 days, orders in progress, low stock, top sellers |
| Live orders | New orders appear automatically with a chime. Accept → preparing → packed → out for delivery → delivered, assign riders, cancel (auto-refunds online payments) |
| Menu & products | Add/edit/delete items, set price, stock and photo, show/hide, filter by restaurant, section and category |
| Restaurants | Add/edit/remove restaurants, open/close them for orders, jump to their menu |
| Categories | Add/edit food and grocery categories, show/hide, set order |
| Payments | Online payments received, unpaid, failed, refunded; retry failed refunds |
| Delivery areas | Pincodes, delivery fee, minimum order, delivery time, on/off |
| Riders | Add riders, activate/deactivate |

Sign in with the backend's `ADMIN_EMAIL` / `ADMIN_PASSWORD`.

## Run locally
```bash
cd console
npm install
CONSOLE_API_URL=http://localhost:8000 npm run dev   # http://localhost:5174
```

## Deploy
It's the `food-market-console` service in `render.yaml` and rebuilds when `Dev-AK` changes. `CONSOLE_API_URL` sets which backend it talks to. No secrets are stored in the console.
