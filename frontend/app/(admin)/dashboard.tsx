import { Ionicons } from "@expo/vector-icons";
import { Image } from "expo-image";
import { useFocusEffect } from "expo-router";
import { useCallback, useState } from "react";
import { ActivityIndicator, ScrollView, StyleSheet, Text, View } from "react-native";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import { api } from "@/src/lib/api";
import { theme, formatINR } from "@/src/lib/theme";

export default function AdminDashboard() {
  const insets = useSafeAreaInsets();
  const [stats, setStats] = useState<any>(null);

  useFocusEffect(useCallback(() => { api.adminStats().then(setStats).catch(() => {}); }, []));

  if (!stats) return <View style={{ flex: 1, backgroundColor: theme.colors.surface, justifyContent: "center" }}><ActivityIndicator color={theme.colors.brand} size="large" /></View>;

  return (
    <View style={{ flex: 1, backgroundColor: theme.colors.surface }}>
      <View style={[styles.header, { paddingTop: insets.top + 12 }]}>
        <Text style={styles.hi}>Welcome back,</Text>
        <Text style={styles.title}>Store Admin</Text>
      </View>
      <ScrollView contentContainerStyle={{ padding: 16, paddingBottom: 100 + insets.bottom }}>
        <View style={styles.row}>
          <Stat label="Today's Revenue" value={formatINR(stats.today_revenue)} sub={`${stats.today_orders} orders`} color={theme.colors.brand} icon="cash" />
          <Stat label="Pending Orders" value={String(stats.pending_orders)} sub="Need attention" color={theme.colors.warning} icon="hourglass" />
        </View>
        <View style={styles.row}>
          <Stat label="Week Revenue" value={formatINR(stats.week_revenue)} sub={`${stats.week_orders} orders`} color={theme.colors.success} icon="trending-up" />
          <Stat label="Month Revenue" value={formatINR(stats.month_revenue)} sub={`${stats.month_orders} orders`} color={theme.colors.brand2} icon="calendar" />
        </View>
        <View style={styles.row}>
          <Stat label="Total Customers" value={String(stats.total_customers)} icon="people" color={theme.colors.on} />
          <Stat label="Active Partners" value={String(stats.active_partners)} icon="bicycle" color={theme.colors.brand} />
        </View>
        <View style={styles.row}>
          <Stat label="Delivered" value={String(stats.completed_orders)} icon="checkmark-done" color={theme.colors.success} />
          <Stat label="Low Stock" value={String(stats.low_stock_products)} icon="alert-circle" color={theme.colors.error} />
        </View>

        <Text style={styles.sec}>Top Selling Products</Text>
        {stats.top_products.length === 0 ? (
          <Text style={styles.empty}>No sales yet</Text>
        ) : (
          stats.top_products.map((p: any) => (
            <View key={p.id} style={styles.prod}>
              <Image source={{ uri: p.image_url }} style={styles.prodImg} />
              <View style={{ flex: 1, marginLeft: 10 }}>
                <Text style={styles.prodName} numberOfLines={2}>{p.name}</Text>
                <Text style={styles.prodSold}>{p.sold_count} sold</Text>
              </View>
              <Text style={styles.prodPrice}>{formatINR(p.price)}</Text>
            </View>
          ))
        )}
      </ScrollView>
    </View>
  );
}

function Stat({ label, value, sub, color, icon }: any) {
  return (
    <View style={styles.stat}>
      <View style={styles.statHead}>
        <Ionicons name={icon} size={18} color={color} />
        <Text style={styles.statLabel}>{label}</Text>
      </View>
      <Text style={[styles.statVal, { color }]}>{value}</Text>
      {sub ? <Text style={styles.statSub}>{sub}</Text> : null}
    </View>
  );
}

const styles = StyleSheet.create({
  header: { padding: 16, backgroundColor: theme.colors.surface2, borderBottomWidth: 1, borderBottomColor: theme.colors.divider },
  hi: { fontSize: 13, color: theme.colors.onMuted },
  title: { fontSize: 24, fontWeight: "800", color: theme.colors.on, marginTop: 2 },
  row: { flexDirection: "row", gap: 12, marginBottom: 12 },
  stat: { flex: 1, backgroundColor: theme.colors.surface2, padding: 14, borderRadius: 14, borderWidth: 1, borderColor: theme.colors.border },
  statHead: { flexDirection: "row", alignItems: "center", gap: 6, marginBottom: 8 },
  statLabel: { fontSize: 12, color: theme.colors.onMuted, fontWeight: "600", flex: 1 },
  statVal: { fontSize: 22, fontWeight: "800" },
  statSub: { fontSize: 11, color: theme.colors.onMuted, marginTop: 2 },
  sec: { fontSize: 18, fontWeight: "800", color: theme.colors.on, marginTop: 8, marginBottom: 12 },
  prod: { flexDirection: "row", alignItems: "center", padding: 12, backgroundColor: theme.colors.surface2, borderRadius: 12, borderWidth: 1, borderColor: theme.colors.border, marginBottom: 8 },
  prodImg: { width: 48, height: 48, borderRadius: 10, backgroundColor: theme.colors.surface3 },
  prodName: { fontSize: 14, fontWeight: "700", color: theme.colors.on },
  prodSold: { fontSize: 12, color: theme.colors.onMuted, marginTop: 2 },
  prodPrice: { fontSize: 15, fontWeight: "800", color: theme.colors.brand },
  empty: { textAlign: "center", color: theme.colors.onMuted, padding: 20, backgroundColor: theme.colors.surface2, borderRadius: 12 },
});
