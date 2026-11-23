import { createRoot } from "react-dom/client";
import { useEffect, useRef, useState } from "react";
import { api, session } from "./api";
import { ToastProvider, useToast } from "./ui";
import Login from "./pages/Login";
import Dashboard from "./pages/Dashboard";
import Orders from "./pages/Orders";
import Menu from "./pages/Menu";
import Restaurants from "./pages/Restaurants";
import Categories from "./pages/Categories";
import Payments from "./pages/Payments";
import Zones from "./pages/Zones";
import Riders from "./pages/Riders";

// Simple hash routes (#/orders?restaurant=…) so the console works as plain
// static files on any host.
const ROUTES: { path: string; label: string; icon: string; el: (q: URLSearchParams) => JSX.Element }[] = [
  { path: "dashboard", label: "Dashboard", icon: "◧", el: () => <Dashboard /> },
  { path: "orders", label: "Live orders", icon: "◉", el: () => <Orders /> },
  { path: "menu", label: "Menu & products", icon: "☰", el: (q) => <Menu initialRestaurant={q.get("restaurant") || ""} /> },
  { path: "restaurants", label: "Restaurants", icon: "⌂", el: () => <Restaurants /> },
  { path: "categories", label: "Categories", icon: "▦", el: () => <Categories /> },
  { path: "payments", label: "Payments", icon: "₹", el: () => <Payments /> },
  { path: "zones", label: "Delivery areas", icon: "⌖", el: () => <Zones /> },
  { path: "riders", label: "Riders", icon: "➜", el: () => <Riders /> },
];

function useHash() {
  const [hash, setHash] = useState(window.location.hash);
  useEffect(() => {
    const f = () => setHash(window.location.hash);
    window.addEventListener("hashchange", f);
    return () => window.removeEventListener("hashchange", f);
  }, []);
  const [path, query] = hash.replace(/^#\/?/, "").split("?");
  return { path: path || "orders", query: new URLSearchParams(query || "") };
}

// Short two-tone chime for new orders (no audio file needed).
function chime() {
  try {
    const Ctx = (window as any).AudioContext || (window as any).webkitAudioContext;
    const ctx = new Ctx();
    [880, 1320].forEach((f, i) => {
      const o = ctx.createOscillator(), g = ctx.createGain();
      o.frequency.value = f; o.connect(g); g.connect(ctx.destination);
      const t = ctx.currentTime + i * 0.18;
      g.gain.setValueAtTime(0.0001, t); g.gain.exponentialRampToValueAtTime(0.25, t + 0.02);
      g.gain.exponentialRampToValueAtTime(0.0001, t + 0.16);
      o.start(t); o.stop(t + 0.17);
    });
  } catch { /* sound blocked until the page is clicked once */ }
}

/** Watches for new (not yet accepted) orders on every page. */
function useNewOrders(enabled: boolean) {
  const toast = useToast();
  const [count, setCount] = useState(0);
  const seen = useRef<Set<string> | null>(null);
  useEffect(() => {
    if (!enabled) return;
    let stop = false;
    const check = async () => {
      try {
        const list: any[] = await api("/api/admin/orders?status=placed");
        if (stop) return;
        setCount(list.length);
        const fresh = seen.current ? list.filter((o) => !seen.current!.has(o.id)) : [];
        seen.current = new Set(list.map((o) => o.id));
        if (fresh.length) {
          chime();
          toast(fresh.length === 1 ? `New order #${fresh[0].order_number}` : `${fresh.length} new orders`, "ok");
        }
      } catch { /* shown on the page itself */ }
    };
    check();
    const t = setInterval(check, 15000);
    return () => { stop = true; clearInterval(t); };
  }, [enabled, toast]);
  return count;
}

function App() {
  const [loggedIn, setLoggedIn] = useState(!!session.token());
  const { path, query } = useHash();
  const newCount = useNewOrders(loggedIn);

  useEffect(() => { session.onUnauthorized(() => setLoggedIn(false)); }, []);
  useEffect(() => {
    document.title = (newCount ? `(${newCount}) ` : "") + "Food Market Console";
  }, [newCount]);

  if (!loggedIn) return <Login onDone={() => setLoggedIn(true)} />;

  const route = ROUTES.find((r) => r.path === path) || ROUTES[1];
  const user = session.user();
  return (
    <div className="shell">
      <aside className="sidebar">
        <div className="brand">
          <div className="brand-mark">DB</div>
          <div><div className="brand-name">Food Market Console</div><div className="brand-sub">DailyBasics admin</div></div>
        </div>
        <nav className="nav">
          {ROUTES.map((r) => (
            <a key={r.path} href={`#/${r.path}`} className={r === route ? "active" : ""}>
              <span aria-hidden>{r.icon}</span>{r.label}
              {r.path === "orders" && newCount > 0 && <span className="count">{newCount}</span>}
            </a>
          ))}
        </nav>
        <div className="sidebar-foot">
          Signed in as<br /><strong>{user?.email || "admin"}</strong>
          <button onClick={() => { session.clear(); setLoggedIn(false); }}>Sign out</button>
        </div>
      </aside>
      <main className="main">{route.el(query)}</main>
    </div>
  );
}

createRoot(document.getElementById("root")!).render(<ToastProvider><App /></ToastProvider>);
