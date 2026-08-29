import { Ionicons } from "@expo/vector-icons";
import { useRouter, useFocusEffect } from "expo-router";
import { useCallback, useState } from "react";
import { Pressable, ScrollView, StyleSheet, Switch, Text, View } from "react-native";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import { api, auth } from "@/src/lib/api";
import { theme, formatINR } from "@/src/lib/theme";

export default function DeliveryDashboard() {
  const insets = useSafeAreaInsets();
  const router = useRouter();
  const [online, setOnline] = useState(true);
  const [orders, setOrders] = useState<any[]>([]);
  const [user, setUser] = useState<any>(null);

  useFocusEffect(useCallback(() => {
    auth.getUser().then(setUser);
    api.orders().then(setOrders).catch(() => {});
    const t = setInterval(() => api.orders().then(setOrders).catch(() => {}), 8000);
    return () => clearInterval(t);
  }, []));

  const active = orders.filter((o) => ["confirmed", "preparing", "packed", "out_for_delivery"].includes(o.status));
  const completed = orders.filter((o) => o.status === "delivered");
  const todayEarnings = completed
    .filter((o) => new Date(o.created_at).toDateString() === new Date().toDateString())
    .reduce((s, o) => s + 30, 0); // ₹30 per delivery
  const totalEarnings = completed.length * 30;

  return (
    <View style={{ flex: 1, backgroundColor: theme.colors.surface }}>
      <View style={[styles.header, { paddingTop: insets.top + 12 }]}>
        <View>
          <Text style={styles.hi}>Hello,</Text>
          <Text style={styles.name}>{user?.name || "Partner"}</Text>
        </View>
        <View style={styles.onlineBox}>
          <Text style={[styles.onlineText, { color: online ? theme.colors.success : theme.colors.onMuted }]}>{online ? "ONLINE" : "OFFLINE"}</Text>
          <Switch value={online} onValueChange={setOnline} thumbColor={online ? theme.colors.success : "#fff"} testID="online-toggle" />
        </View>
      </View>

      <ScrollView contentContainerStyle={{ padding: 16, paddingBottom: 100 + insets.bottom }}>
        <View style={styles.statRow}>
          <View style={[styles.stat, { backgroundColor: theme.colors.brandLight }]}>
            <Text style={styles.statLabel}>Today's Earnings</Text>
            <Text style={styles.statVal}>{formatINR(todayEarnings)}</Text>
          </View>
          <View style={[styles.stat, { backgroundColor: theme.colors.success + "20" }]}>
            <Text style={styles.statLabel}>Total Earnings</Text>
            <Text style={styles.statVal}>{formatINR(totalEarnings)}</Text>
          </View>
        </View>
        <View style={styles.statRow}>
          <View style={styles.statSmall}>
            <Text style={styles.statLabel}>Active</Text>
            <Text style={[styles.statVal, { color: theme.colors.brand }]}>{active.length}</Text>
          </View>
          <View style={styles.statSmall}>
            <Text style={styles.statLabel}>Delivered</Text>
            <Text style={[styles.statVal, { color: theme.colors.success }]}>{completed.length}</Text>
          </View>
        </View>

        <Text style={styles.sec}>Active Deliveries</Text>
        {active.length === 0 ? (
          <View style={styles.empty}>
            <Ionicons name="bicycle-outline" size={60} color={theme.colors.onMuted} />
            <Text style={styles.emptyText}>No active deliveries</Text>
            <Text style={styles.emptySub}>New orders will appear here</Text>
          </View>
        ) : (
          active.map((o) => (
            <Pressable key={o.id} style={styles.card} onPress={() => router.push({ pathname: "/(delivery)/order/[id]", params: { id: o.id } })} testID={`dp-order-${o.id}`}>
              <View style={{ flexDirection: "row", justifyContent: "space-between", alignItems: "center" }}>
                <Text style={styles.oid}>#{o.order_number}</Text>
                <View style={styles.statusPill}><Text style={styles.statusText}>{o.status.replace(/_/g, " ")}</Text></View>
              </View>
              <Text style={styles.customer}>{o.user_name || o.user_phone}</Text>
              <Text style={styles.addr}>{o.address.village}, {o.address.pincode}</Text>
              <View style={styles.cardFoot}>
                <View style={{ flexDirection: "row", alignItems: "center", gap: 4 }}>
                  <Ionicons name="cash" size={14} color={theme.colors.brand} />
                  <Text style={styles.total}>{formatINR(o.total)} • {o.payment_method.toUpperCase()}</Text>
                </View>
                <Ionicons name="chevron-forward" size={18} color={theme.colors.onMuted} />
              </View>
            </Pressable>
          ))
        )}
      </ScrollView>
    </View>
  );
}

const styles = StyleSheet.create({
  header: { flexDirection: "row", justifyContent: "space-between", alignItems: "center", padding: 16, backgroundColor: theme.colors.surface2, borderBottomWidth: 1, borderBottomColor: theme.colors.divider },
  hi: { fontSize: 14, color: theme.colors.onMuted },
  name: { fontSize: 22, fontWeight: "800", color: theme.colors.on },
  onlineBox: { alignItems: "center", gap: 4 },
  onlineText: { fontSize: 12, fontWeight: "800" },
  statRow: { flexDirection: "row", gap: 12, marginBottom: 12 },
  stat: { flex: 1, padding: 16, borderRadius: 16 },
  statSmall: { flex: 1, padding: 12, borderRadius: 12, backgroundColor: theme.colors.surface2, borderWidth: 1, borderColor: theme.colors.border },
  statLabel: { fontSize: 12, color: theme.colors.onMuted, marginBottom: 4 },
  statVal: { fontSize: 22, fontWeight: "800", color: theme.colors.on },
  sec: { fontSize: 18, fontWeight: "800", color: theme.colors.on, marginTop: 12, marginBottom: 12 },
  empty: { alignItems: "center", padding: 40, backgroundColor: theme.colors.surface2, borderRadius: 16, borderWidth: 1, borderColor: theme.colors.border },
  emptyText: { fontSize: 16, fontWeight: "800", color: theme.colors.on, marginTop: 12 },
  emptySub: { fontSize: 13, color: theme.colors.onMuted, marginTop: 4 },
  card: { padding: 14, backgroundColor: theme.colors.surface2, borderRadius: 14, borderWidth: 1, borderColor: theme.colors.border, marginBottom: 10 },
  oid: { fontSize: 14, fontWeight: "800", color: theme.colors.on },
  statusPill: { paddingHorizontal: 10, paddingVertical: 3, backgroundColor: theme.colors.brandLight, borderRadius: 999 },
  statusText: { fontSize: 11, fontWeight: "800", color: theme.colors.brand, textTransform: "uppercase" },
  customer: { fontSize: 15, fontWeight: "700", color: theme.colors.on, marginTop: 6 },
  addr: { fontSize: 13, color: theme.colors.onMuted, marginTop: 2 },
  cardFoot: { flexDirection: "row", justifyContent: "space-between", alignItems: "center", marginTop: 8 },
  total: { fontSize: 14, fontWeight: "800", color: theme.colors.on },
});
