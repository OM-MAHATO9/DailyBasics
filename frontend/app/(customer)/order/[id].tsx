import { Ionicons } from "@expo/vector-icons";
import { Image } from "expo-image";
import { useLocalSearchParams, useRouter } from "expo-router";
import { useCallback, useState } from "react";
import { useFocusEffect } from "expo-router";
import { ActivityIndicator, Linking, Pressable, ScrollView, StyleSheet, Text, View } from "react-native";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import { api } from "@/src/lib/api";
import { theme, formatINR } from "@/src/lib/theme";

const STEPS = [
  { key: "placed", label: "Order Placed", icon: "receipt" as const },
  { key: "confirmed", label: "Confirmed", icon: "checkmark-circle" as const },
  { key: "preparing", label: "Preparing", icon: "restaurant" as const },
  { key: "packed", label: "Packed", icon: "cube" as const },
  { key: "out_for_delivery", label: "Out for Delivery", icon: "bicycle" as const },
  { key: "delivered", label: "Delivered", icon: "home" as const },
];

export default function OrderTracking() {
  const { id } = useLocalSearchParams<{ id: string }>();
  const insets = useSafeAreaInsets();
  const router = useRouter();
  const [order, setOrder] = useState<any>(null);
  const [loading, setLoading] = useState(true);
  const [cancelling, setCancelling] = useState(false);

  const load = useCallback(async () => {
    try { setOrder(await api.order(id as string)); }
    catch {} finally { setLoading(false); }
  }, [id]);

  useFocusEffect(useCallback(() => { load(); const t = setInterval(load, 8000); return () => clearInterval(t); }, [load]));

  const cancel = async () => {
    setCancelling(true);
    try { await api.updateOrderStatus(id as string, { status: "cancelled" }); await load(); } catch {} finally { setCancelling(false); }
  };

  if (loading || !order) return <View style={{ flex: 1, backgroundColor: theme.colors.surface, justifyContent: "center" }}><ActivityIndicator size="large" color={theme.colors.brand} /></View>;

  const currentIdx = STEPS.findIndex((s) => s.key === order.status);
  const cancelled = order.status === "cancelled";

  return (
    <View style={{ flex: 1, backgroundColor: theme.colors.surface }}>
      <View style={[styles.header, { paddingTop: insets.top + 12 }]}>
        <Pressable onPress={() => router.back()} testID="ot-back"><Ionicons name="arrow-back" size={24} color={theme.colors.on} /></Pressable>
        <Text style={styles.title}>Order #{order.order_number}</Text>
        <View style={{ width: 24 }} />
      </View>
      <ScrollView contentContainerStyle={{ padding: 16, paddingBottom: 24 + insets.bottom }}>
        <View style={styles.etaCard}>
          <Ionicons name={cancelled ? "close-circle" : "time"} size={28} color={cancelled ? theme.colors.error : theme.colors.brand} />
          <View style={{ marginLeft: 12, flex: 1 }}>
            <Text style={styles.etaLabel}>{cancelled ? "Order Cancelled" : "Estimated Delivery"}</Text>
            <Text style={styles.etaTime}>{cancelled ? "This order was cancelled" : `${order.eta_minutes} minutes`}</Text>
          </View>
        </View>

        {!cancelled && (
          <View style={styles.stepper}>
            {STEPS.map((s, i) => {
              const done = i <= currentIdx;
              const active = i === currentIdx;
              return (
                <View key={s.key} style={styles.stepRow}>
                  <View style={styles.stepLine}>
                    <View style={[styles.stepDot, done && { backgroundColor: theme.colors.brand }, active && { backgroundColor: theme.colors.success }]}>
                      <Ionicons name={s.icon} size={16} color={done ? "#fff" : theme.colors.onMuted} />
                    </View>
                    {i < STEPS.length - 1 && <View style={[styles.stepConn, done && { backgroundColor: theme.colors.brand }]} />}
                  </View>
                  <View style={{ flex: 1, paddingBottom: 24 }}>
                    <Text style={[styles.stepLabel, done && { color: theme.colors.on, fontWeight: "800" }]}>{s.label}</Text>
                    {active && !cancelled && <Text style={styles.stepActive}>In progress...</Text>}
                  </View>
                </View>
              );
            })}
          </View>
        )}

        {order.delivery_partner_name && (
          <View style={styles.partner}>
            <View style={styles.partnerAvatar}><Ionicons name="person" size={22} color="#fff" /></View>
            <View style={{ flex: 1 }}>
              <Text style={styles.partnerLabel}>Delivery Partner</Text>
              <Text style={styles.partnerName}>{order.delivery_partner_name}</Text>
            </View>
            <Pressable style={styles.callBtn} onPress={() => Linking.openURL(`tel:+91${order.delivery_partner_phone}`)} testID="call-partner">
              <Ionicons name="call" size={20} color="#fff" />
            </Pressable>
          </View>
        )}

        {order.status === "out_for_delivery" && (
          <View style={styles.otpCard}>
            <Ionicons name="key" size={20} color={theme.colors.brand} />
            <View style={{ marginLeft: 8, flex: 1 }}>
              <Text style={styles.otpLabel}>Share this OTP with delivery partner</Text>
              <Text style={styles.otpVal}>{order.delivery_otp}</Text>
            </View>
          </View>
        )}

        <View style={styles.card}>
          <Text style={styles.cardTitle}>Delivery Address</Text>
          <Text style={styles.addrText}>{order.address.house}{order.address.landmark ? `, ${order.address.landmark}` : ""}</Text>
          <Text style={styles.addrText}>{order.address.village} - {order.address.pincode}</Text>
          <Text style={styles.addrText}>Phone: {order.address.phone}</Text>
        </View>

        <View style={styles.card}>
          <Text style={styles.cardTitle}>{order.items.length} Item{order.items.length > 1 ? "s" : ""}</Text>
          {order.items.map((it: any, i: number) => (
            <View key={i} style={styles.itemRow}>
              <Image source={{ uri: it.image_url }} style={styles.itemImg} />
              <View style={{ flex: 1, marginLeft: 10 }}>
                <Text style={styles.itemName} numberOfLines={2}>{it.name}</Text>
                <Text style={styles.itemQty}>{it.quantity} × {formatINR(it.price)}</Text>
              </View>
              <Text style={styles.itemTotal}>{formatINR(it.line_total)}</Text>
            </View>
          ))}
          <View style={styles.div} />
          <Row k="Subtotal" v={formatINR(order.subtotal)} />
          <Row k="Delivery" v={formatINR(order.delivery_charge)} />
          {order.coupon_discount > 0 && <Row k={`Coupon (${order.coupon_code})`} v={`- ${formatINR(order.coupon_discount)}`} vColor={theme.colors.success} />}
          {order.wallet_applied > 0 && <Row k="Wallet Used" v={`- ${formatINR(order.wallet_applied)}`} vColor={theme.colors.success} />}
          <View style={styles.div} />
          <Row k="Total" v={formatINR(order.total)} bold />
          <Row k="Payment" v={order.payment_method.toUpperCase()} />
        </View>

        {!cancelled && ["placed", "confirmed"].includes(order.status) && (
          <Pressable style={styles.cancelBtn} onPress={cancel} disabled={cancelling} testID="cancel-order">
            {cancelling ? <ActivityIndicator color={theme.colors.error} /> : <Text style={styles.cancelText}>Cancel Order</Text>}
          </Pressable>
        )}
      </ScrollView>
    </View>
  );
}

function Row({ k, v, vColor, bold }: any) {
  return <View style={{ flexDirection: "row", justifyContent: "space-between", paddingVertical: 4 }}>
    <Text style={[{ color: theme.colors.on, fontSize: 14 }, bold && { fontWeight: "800", fontSize: 16 }]}>{k}</Text>
    <Text style={[{ color: theme.colors.on, fontSize: 14, fontWeight: "600" }, vColor && { color: vColor }, bold && { fontWeight: "800", fontSize: 16 }]}>{v}</Text>
  </View>;
}

const styles = StyleSheet.create({
  header: { flexDirection: "row", alignItems: "center", paddingHorizontal: 16, paddingBottom: 12, backgroundColor: theme.colors.surface2, borderBottomWidth: 1, borderBottomColor: theme.colors.divider },
  title: { flex: 1, fontSize: 18, fontWeight: "800", color: theme.colors.on, textAlign: "center" },
  etaCard: { flexDirection: "row", alignItems: "center", padding: 16, backgroundColor: theme.colors.brandLight, borderRadius: 16, marginBottom: 16 },
  etaLabel: { fontSize: 13, color: theme.colors.onMuted },
  etaTime: { fontSize: 20, fontWeight: "800", color: theme.colors.on, marginTop: 2 },
  stepper: { padding: 16, backgroundColor: theme.colors.surface2, borderRadius: 16, borderWidth: 1, borderColor: theme.colors.border, marginBottom: 16 },
  stepRow: { flexDirection: "row", alignItems: "flex-start" },
  stepLine: { alignItems: "center", marginRight: 12 },
  stepDot: { width: 32, height: 32, borderRadius: 16, backgroundColor: theme.colors.surface3, alignItems: "center", justifyContent: "center" },
  stepConn: { width: 2, flex: 1, minHeight: 20, backgroundColor: theme.colors.surface3 },
  stepLabel: { fontSize: 14, color: theme.colors.onMuted, fontWeight: "600" },
  stepActive: { fontSize: 12, color: theme.colors.success, fontWeight: "700", marginTop: 2 },
  partner: { flexDirection: "row", alignItems: "center", gap: 12, padding: 14, backgroundColor: theme.colors.surface2, borderRadius: 16, borderWidth: 1, borderColor: theme.colors.border, marginBottom: 16 },
  partnerAvatar: { width: 44, height: 44, borderRadius: 22, backgroundColor: theme.colors.brand, alignItems: "center", justifyContent: "center" },
  partnerLabel: { fontSize: 12, color: theme.colors.onMuted },
  partnerName: { fontSize: 16, fontWeight: "800", color: theme.colors.on },
  callBtn: { width: 44, height: 44, borderRadius: 22, backgroundColor: theme.colors.success, alignItems: "center", justifyContent: "center" },
  otpCard: { flexDirection: "row", alignItems: "center", padding: 14, backgroundColor: theme.colors.brandLight, borderRadius: 12, marginBottom: 16 },
  otpLabel: { fontSize: 12, color: theme.colors.on },
  otpVal: { fontSize: 22, fontWeight: "800", letterSpacing: 4, color: theme.colors.brand, marginTop: 2 },
  card: { backgroundColor: theme.colors.surface2, borderRadius: 16, padding: 14, borderWidth: 1, borderColor: theme.colors.border, marginBottom: 16 },
  cardTitle: { fontSize: 16, fontWeight: "800", color: theme.colors.on, marginBottom: 8 },
  addrText: { fontSize: 14, color: theme.colors.on, lineHeight: 20 },
  itemRow: { flexDirection: "row", alignItems: "center", paddingVertical: 8 },
  itemImg: { width: 44, height: 44, borderRadius: 8, backgroundColor: theme.colors.surface3 },
  itemName: { fontSize: 14, fontWeight: "600", color: theme.colors.on },
  itemQty: { fontSize: 12, color: theme.colors.onMuted, marginTop: 2 },
  itemTotal: { fontSize: 14, fontWeight: "800", color: theme.colors.on },
  div: { height: 1, backgroundColor: theme.colors.divider, marginVertical: 8 },
  cancelBtn: { padding: 14, borderRadius: 12, borderWidth: 1.5, borderColor: theme.colors.error, alignItems: "center", backgroundColor: theme.colors.surface2 },
  cancelText: { color: theme.colors.error, fontWeight: "800", fontSize: 15 },
});
