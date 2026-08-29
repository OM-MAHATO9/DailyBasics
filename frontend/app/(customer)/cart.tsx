import { Ionicons } from "@expo/vector-icons";
import { Image } from "expo-image";
import { useRouter } from "expo-router";
import { Pressable, ScrollView, StyleSheet, Text, View } from "react-native";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import { useCart } from "@/src/lib/cart";
import { theme, formatINR } from "@/src/lib/theme";

export default function Cart() {
  const router = useRouter();
  const insets = useSafeAreaInsets();
  const { items, setQty, remove, subtotal, savings } = useCart();

  const empty = items.length === 0;
  return (
    <View style={{ flex: 1, backgroundColor: theme.colors.surface }}>
      <View style={[styles.header, { paddingTop: insets.top + 12 }]}>
        <Pressable onPress={() => router.back()} testID="cart-back"><Ionicons name="arrow-back" size={24} color={theme.colors.on} /></Pressable>
        <Text style={styles.title}>My Cart</Text>
        <View style={{ width: 24 }} />
      </View>
      {empty ? (
        <View style={styles.empty}>
          <Ionicons name="basket-outline" size={80} color={theme.colors.onMuted} />
          <Text style={styles.emptyText}>Your cart is empty</Text>
          <Text style={styles.emptySub}>Let's add something!</Text>
          <Pressable style={styles.shopBtn} onPress={() => router.replace("/(customer)/home")} testID="cart-shop-btn">
            <Text style={styles.shopText}>Start Shopping</Text>
          </Pressable>
        </View>
      ) : (
        <>
          <ScrollView contentContainerStyle={{ padding: 16, paddingBottom: 200 + insets.bottom }}>
            <View style={styles.savingsBanner}>
              <Ionicons name="pricetag" size={16} color={theme.colors.success} />
              <Text style={styles.savingsText}>You're saving {formatINR(savings)} on this order</Text>
            </View>
            {items.map((it) => (
              <View key={it.product_id} style={styles.item} testID={`cart-item-${it.product_id}`}>
                <Image source={{ uri: it.image_url }} style={styles.thumb} />
                <View style={{ flex: 1 }}>
                  <Text style={styles.name} numberOfLines={2}>{it.name}</Text>
                  <Text style={styles.unit}>{it.unit}</Text>
                  <View style={styles.pr}>
                    <Text style={styles.price}>{formatINR(it.price)}</Text>
                    {it.mrp > it.price && <Text style={styles.mrp}>{formatINR(it.mrp)}</Text>}
                  </View>
                </View>
                <View style={styles.qtyBox}>
                  <Pressable onPress={() => setQty(it.product_id, it.quantity - 1)} style={styles.qBtn} testID={`cart-dec-${it.product_id}`}><Ionicons name="remove" size={18} color="#fff" /></Pressable>
                  <Text style={styles.qTxt}>{it.quantity}</Text>
                  <Pressable onPress={() => setQty(it.product_id, it.quantity + 1)} style={styles.qBtn} testID={`cart-inc-${it.product_id}`}><Ionicons name="add" size={18} color="#fff" /></Pressable>
                </View>
              </View>
            ))}
            <View style={styles.bill}>
              <Text style={styles.billTitle}>Bill Details</Text>
              <BillRow k="Item Total" v={formatINR(subtotal)} />
              <BillRow k="Total Savings" v={`- ${formatINR(savings)}`} valueColor={theme.colors.success} />
              <BillRow k="Delivery Charge" v="Calculated at checkout" />
              <View style={styles.billDiv} />
              <BillRow k="Estimated Total" v={formatINR(subtotal)} bold />
            </View>
          </ScrollView>
          <View style={[styles.footer, { paddingBottom: insets.bottom + 12 }]}>
            <View style={{ flex: 1 }}>
              <Text style={styles.total}>{formatINR(subtotal)}</Text>
              <Text style={styles.plus}>+ delivery at checkout</Text>
            </View>
            <Pressable style={styles.cta} onPress={() => router.push("/(customer)/checkout")} testID="cart-checkout-btn">
              <Text style={styles.ctaText}>Checkout</Text>
              <Ionicons name="arrow-forward" size={20} color="#fff" />
            </Pressable>
          </View>
        </>
      )}
    </View>
  );
}

function BillRow({ k, v, valueColor, bold }: any) {
  return (
    <View style={styles.billRow}>
      <Text style={[styles.billK, bold && { fontWeight: "800", fontSize: 16 }]}>{k}</Text>
      <Text style={[styles.billV, bold && { fontWeight: "800", fontSize: 16 }, valueColor && { color: valueColor }]}>{v}</Text>
    </View>
  );
}

const styles = StyleSheet.create({
  header: { flexDirection: "row", alignItems: "center", paddingHorizontal: 16, paddingBottom: 12, backgroundColor: theme.colors.surface2, borderBottomWidth: 1, borderBottomColor: theme.colors.divider },
  title: { flex: 1, fontSize: 20, fontWeight: "800", color: theme.colors.on, textAlign: "center" },
  empty: { flex: 1, alignItems: "center", justifyContent: "center", padding: 24 },
  emptyText: { fontSize: 20, fontWeight: "800", color: theme.colors.on, marginTop: 16 },
  emptySub: { fontSize: 15, color: theme.colors.onMuted, marginTop: 4 },
  shopBtn: { marginTop: 24, backgroundColor: theme.colors.brand, paddingHorizontal: 32, paddingVertical: 14, borderRadius: 12 },
  shopText: { color: "#fff", fontWeight: "800", fontSize: 16 },
  savingsBanner: { flexDirection: "row", alignItems: "center", gap: 8, backgroundColor: theme.colors.success + "20", padding: 12, borderRadius: 12, marginBottom: 12 },
  savingsText: { color: theme.colors.success, fontWeight: "700" },
  item: { flexDirection: "row", gap: 12, alignItems: "center", padding: 12, backgroundColor: theme.colors.surface2, borderRadius: 14, marginBottom: 10, borderWidth: 1, borderColor: theme.colors.border },
  thumb: { width: 64, height: 64, borderRadius: 10, backgroundColor: theme.colors.surface3 },
  name: { fontSize: 14, fontWeight: "700", color: theme.colors.on },
  unit: { fontSize: 12, color: theme.colors.onMuted, marginTop: 2 },
  pr: { flexDirection: "row", gap: 6, alignItems: "center", marginTop: 4 },
  price: { fontSize: 15, fontWeight: "800", color: theme.colors.on },
  mrp: { fontSize: 12, color: theme.colors.onMuted, textDecorationLine: "line-through" },
  qtyBox: { flexDirection: "row", alignItems: "center", backgroundColor: theme.colors.brand, borderRadius: 8, overflow: "hidden" },
  qBtn: { paddingHorizontal: 8, paddingVertical: 6 },
  qTxt: { color: "#fff", fontWeight: "800", minWidth: 24, textAlign: "center" },
  bill: { backgroundColor: theme.colors.surface2, borderRadius: 14, padding: 14, marginTop: 8, borderWidth: 1, borderColor: theme.colors.border },
  billTitle: { fontSize: 16, fontWeight: "800", color: theme.colors.on, marginBottom: 10 },
  billRow: { flexDirection: "row", justifyContent: "space-between", paddingVertical: 6 },
  billK: { color: theme.colors.on, fontSize: 14 },
  billV: { color: theme.colors.on, fontSize: 14, fontWeight: "600" },
  billDiv: { height: 1, backgroundColor: theme.colors.divider, marginVertical: 8 },
  footer: { position: "absolute", left: 0, right: 0, bottom: 0, flexDirection: "row", alignItems: "center", padding: 12, backgroundColor: theme.colors.surface2, borderTopWidth: 1, borderTopColor: theme.colors.divider, gap: 12 },
  total: { fontSize: 20, fontWeight: "800", color: theme.colors.on },
  plus: { fontSize: 12, color: theme.colors.onMuted },
  cta: { flexDirection: "row", alignItems: "center", gap: 6, backgroundColor: theme.colors.brand, paddingHorizontal: 28, paddingVertical: 14, borderRadius: 12 },
  ctaText: { color: "#fff", fontSize: 16, fontWeight: "800" },
});
