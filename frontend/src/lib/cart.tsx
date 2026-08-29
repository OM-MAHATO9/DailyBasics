import React, { createContext, useContext, useState, useEffect, useCallback } from "react";
import AsyncStorage from "@react-native-async-storage/async-storage";

export type CartItem = {
  product_id: string;
  name: string;
  brand: string;
  price: number;
  mrp: number;
  image_url: string;
  unit: string;
  quantity: number;
};

interface CartCtx {
  items: CartItem[];
  add: (p: any) => void;
  remove: (product_id: string) => void;
  setQty: (product_id: string, quantity: number) => void;
  clear: () => void;
  subtotal: number;
  count: number;
  savings: number;
}

const Ctx = createContext<CartCtx | null>(null);
const KEY = "db_cart_v1";

export function CartProvider({ children }: { children: React.ReactNode }) {
  const [items, setItems] = useState<CartItem[]>([]);
  const [ready, setReady] = useState(false);

  useEffect(() => {
    AsyncStorage.getItem(KEY).then((s) => {
      if (s) setItems(JSON.parse(s));
      setReady(true);
    });
  }, []);

  useEffect(() => {
    if (ready) AsyncStorage.setItem(KEY, JSON.stringify(items));
  }, [items, ready]);

  const add = useCallback((p: any) => {
    setItems((prev) => {
      const idx = prev.findIndex((x) => x.product_id === p.id);
      if (idx >= 0) {
        const next = [...prev];
        next[idx] = { ...next[idx], quantity: next[idx].quantity + 1 };
        return next;
      }
      return [
        ...prev,
        {
          product_id: p.id,
          name: p.name,
          brand: p.brand || "",
          price: p.price,
          mrp: p.mrp,
          image_url: p.image_url || "",
          unit: p.unit || "",
          quantity: 1,
        },
      ];
    });
  }, []);

  const remove = useCallback((id: string) => setItems((p) => p.filter((x) => x.product_id !== id)), []);
  const setQty = useCallback(
    (id: string, q: number) =>
      setItems((p) => (q <= 0 ? p.filter((x) => x.product_id !== id) : p.map((x) => (x.product_id === id ? { ...x, quantity: q } : x)))),
    []
  );
  const clear = useCallback(() => setItems([]), []);

  const subtotal = items.reduce((s, i) => s + i.price * i.quantity, 0);
  const savings = items.reduce((s, i) => s + (i.mrp - i.price) * i.quantity, 0);
  const count = items.reduce((s, i) => s + i.quantity, 0);

  return <Ctx.Provider value={{ items, add, remove, setQty, clear, subtotal, count, savings }}>{children}</Ctx.Provider>;
}

export function useCart() {
  const c = useContext(Ctx);
  if (!c) throw new Error("CartProvider missing");
  return c;
}
