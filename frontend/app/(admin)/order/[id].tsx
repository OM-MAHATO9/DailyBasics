import { Ionicons } from "@expo/vector-icons";
import { Image } from "expo-image";
import { useLocalSearchParams, useRouter, useFocusEffect } from "expo-router";
import { useCallback, useState } from "react";
import { ActivityIndicator, Pressable, ScrollView, StyleSheet, Text, View } from "react-native";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import { api } from "@/src/lib/api";
import { theme, formatINR } from "@/src/lib/theme";

const NEXT_MAP: Record<string, string[]> = {
  placed: ["confirmed", "cancelled"],
  confirmed: ["preparing"],
  preparing: ["packed"],
  packed: ["out_for_delivery"],
  out_for_delivery: [],
  delivered: [],
  cancelled: [],
};

export default function AdminOrderDetail() {
  const { id } = useLocalSearchParams<{ id: string }>();
  const insets = useSafeAreaInsets();
  const router = useRouter();
  const [order, setOrder] = useState<any>(null);
  const [partners, setPartners] = useState<any[]>([]);
  const [loading, setLoading] = useState(false);

  const load = useCallback(async () => {
    const [o, p] = await Promise.all([api.order(id as string), api.adminPartners()]);
    setOrder(o); setPartners(p.filter((x: any) => x.is_active));
  }, [id]);
  useFocusEffect(useCallback(() => { load(); }, [load]));

  if (!order) return <View style={{ flex: 1, backgroundColor: theme.colors.surface, justifyContent: "center" }}><ActivityIndicator color={theme.colors.brand} size="large" /></View>;

  const setStatus = async (s: string) => {
    setLoading(true);
    try { await api.updateOrderStatus(id as string, { status: s }); await load(); } catch {} finally { setLoading(false); }
  };
  const assign = async (pid: string) => {
    setLoading(true);
    try { await api.assignPartner(id as string, pid); await load(); } catch {} finally { setLoading(false); }
  };
  const nextOptions = NEXT_MAP[order.status] || [];

  return (
    <View style={{ flex: 1, backgroundColor: theme.colors.surface }}>
      <View style={[styles.header, { paddingTop: insets.top + 12 }]}>
        <Pressable onPress={() => router.back()}><Ionicons name="arrow-back" size={24} color={theme.colors.on} /></Pressable>
        <Text style={styles.title}>#{order.order_number}</Text>
        <View style={{ width: 24 }} />
      </View>
      <ScrollView contentContainerStyle={{ padding: 16, paddingBottom: 40 + insets.bottom }}>
        <View style={styles.status}>
          <Text style={styles.statusLabel}>Current Status</Text>
          <Text style={styles.statusVal}>{order.status.replace(/_/g, " ").toUpperCase()}</Text>
          <Text style={{ marginTop: 6, color: theme.colors.onMuted, fontSize: 12 }}>Payment: {order.payment_method.toUpperCase()} • {order.payment_status}</Text>
        </View>

        <View style={styles.card}>
          <Text style={styles.cardTitle}>Customer</Text>
          <Text style={styles.txt}>{order.user_name || "N/A"}</Text>
          <Text style={styles.muted}>+91 {order.user_phone}</Text>
          <Text style={styles.muted}>{order.address.house}, {order.address.village} - {order.address.pincode}</Text>
        </View>

        <View style={styles.card}>
          <Text style={styles.cardTitle}>Items ({order.items.length})</Text>
          {order.items.map((it: any, i: number) => (
            <View key={i} style={{ flexDirection: "row", alignItems: "center", paddingVertical: 6 }}>
              <Image source={{ uri: it.image_url }} style={styles.thumb} />
              <View style={{ flex: 1, marginLeft: 8 }}>
                <Text style={{ fontSize: 13, fontWeight: "600" }}>{it.name}</Text>
                <Text style={{ fontSize: 12, color: theme.colors.onMuted }}>Qty: {it.quantity} × {formatINR(it.price)}</Text>
              </View>
              <Text style={{ fontWeight: "800" }}>{formatINR(it.line_total)}</Text>
            </View>
          ))}
          <View style={{ height: 1, backgroundColor: theme.colors.divider, marginVertical: 8 }} />
          <View style={{ flexDirection: "row", justifyContent: "space-between" }}>
            <Text style={{ fontWeight: "800" }}>Total</Text>
            <Text style={{ fontWeight: "800", fontSize: 18, color: theme.colors.brand }}>{formatINR(order.total)}</Text>
          </View>
        </View>

        {!order.delivery_partner_id && order.status !== "delivered" && order.status !== "cancelled" && (
          <View style={styles.card}>
            <Text style={styles.cardTitle}>Assign Delivery Partner</Text>
            {partners.map((p) => (
              <Pressable key={p.id} style={styles.partnerRow} onPress={() => assign(p.id)} testID={`assign-${p.id}`}>
                <Ionicons name="bicycle" size={22} color={theme.colors.brand} />
                <View style={{ flex: 1, marginLeft: 10 }}>
                  <Text style={{ fontWeight: "700" }}>{p.name}</Text>
                  <Text style={{ fontSize: 12, color: theme.colors.onMuted }}>+91 {p.phone}</Text>
                </View>
                <Ionicons name="chevron-forward" size={20} color={theme.colors.onMuted} />
              </Pressable>
            ))}
            {partners.length === 0 && <Text style={styles.muted}>No active partners</Text>}
          </View>
        )}

        {order.delivery_partner_name && (
          <View style={styles.card}>
            <Text style={styles.cardTitle}>Assigned To</Text>
            <Text style={styles.txt}>{order.delivery_partner_name}</Text>
            <Text style={styles.muted}>+91 {order.delivery_partner_phone}</Text>
          </View>
        )}

        {nextOptions.length > 0 && (
          <View style={styles.card}>
            <Text style={styles.cardTitle}>Update Status</Text>
            <View style={{ gap: 8 }}>
              {nextOptions.map((s) => (
                <Pressable
                  key={s}
                  style={[styles.actBtn, s === "cancelled" && { backgroundColor: theme.colors.error }]}
                  onPress={() => setStatus(s)}
                  disabled={loading}
                  testID={`set-status-${s}`}
                >
                  <Text style={styles.actText}>{s.replace(/_/g, " ").toUpperCase()}</Text>
                </Pressable>
              ))}
            </View>
          </View>
        )}
      </ScrollView>
    </View>
  );
}

const styles = StyleSheet.create({
  header: { flexDirection: "row", alignItems: "center", paddingHorizontal: 16, paddingBottom: 12, backgroundColor: theme.colors.surface2, borderBottomWidth: 1, borderBottomColor: theme.colors.divider },
  title: { flex: 1, fontSize: 18, fontWeight: "800", color: theme.colors.on, textAlign: "center" },
  status: { padding: 14, backgroundColor: theme.colors.brandLight, borderRadius: 12, marginBottom: 12 },
  statusLabel: { fontSize: 12, color: theme.colors.onMuted },
  statusVal: { fontSize: 20, fontWeight: "800", color: theme.colors.brand, marginTop: 2 },
  card: { padding: 14, backgroundColor: theme.colors.surface2, borderRadius: 12, borderWidth: 1, borderColor: theme.colors.border, marginBottom: 12 },
  cardTitle: { fontSize: 13, fontWeight: "800", color: theme.colors.on, marginBottom: 8, textTransform: "uppercase" },
  txt: { fontSize: 15, fontWeight: "700", color: theme.colors.on },
  muted: { fontSize: 13, color: theme.colors.onMuted, marginTop: 2 },
  thumb: { width: 36, height: 36, borderRadius: 8, backgroundColor: theme.colors.surface3 },
  partnerRow: { flexDirection: "row", alignItems: "center", padding: 10, backgroundColor: theme.colors.surface3, borderRadius: 10, marginBottom: 6 },
  actBtn: { backgroundColor: theme.colors.brand, padding: 12, borderRadius: 10, alignItems: "center" },
  actText: { color: "#fff", fontWeight: "800", fontSize: 14 },
});
