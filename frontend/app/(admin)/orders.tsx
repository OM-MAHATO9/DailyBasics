import { Ionicons } from "@expo/vector-icons";
import { useRouter, useFocusEffect } from "expo-router";
import { useCallback, useState } from "react";
import { FlatList, Pressable, ScrollView, StyleSheet, Text, View } from "react-native";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import { api } from "@/src/lib/api";
import { theme, formatINR } from "@/src/lib/theme";

const FILTERS = [
  { key: "", label: "All" },
  { key: "placed", label: "New" },
  { key: "confirmed", label: "Confirmed" },
  { key: "preparing", label: "Preparing" },
  { key: "packed", label: "Packed" },
  { key: "out_for_delivery", label: "Out" },
  { key: "delivered", label: "Delivered" },
  { key: "cancelled", label: "Cancelled" },
];

export default function AdminOrders() {
  const router = useRouter();
  const insets = useSafeAreaInsets();
  const [filter, setFilter] = useState("");
  const [orders, setOrders] = useState<any[]>([]);

  const load = useCallback(() => {
    api.adminOrders(filter || undefined).then(setOrders).catch(() => {});
  }, [filter]);
  useFocusEffect(useCallback(() => { load(); const t = setInterval(load, 6000); return () => clearInterval(t); }, [load]));

  return (
    <View style={{ flex: 1, backgroundColor: theme.colors.surface }}>
      <View style={[styles.header, { paddingTop: insets.top + 12 }]}>
        <Text style={styles.title}>Orders</Text>
        <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={{ paddingHorizontal: 16, gap: 8, paddingTop: 12 }}>
          {FILTERS.map((f) => (
            <Pressable key={f.key} onPress={() => setFilter(f.key)} style={[styles.chip, filter === f.key && styles.chipActive]} testID={`ord-filter-${f.key || "all"}`}>
              <Text style={[styles.chipText, filter === f.key && { color: "#fff" }]}>{f.label}</Text>
            </Pressable>
          ))}
        </ScrollView>
      </View>
      <FlatList
        data={orders}
        keyExtractor={(o) => o.id}
        contentContainerStyle={{ padding: 16, gap: 10, paddingBottom: 100 + insets.bottom }}
        renderItem={({ item }) => (
          <Pressable style={styles.card} onPress={() => router.push({ pathname: "/(admin)/order/[id]", params: { id: item.id } })} testID={`admin-order-${item.id}`}>
            <View style={{ flexDirection: "row", justifyContent: "space-between" }}>
              <Text style={styles.oid}>#{item.order_number}</Text>
              <View style={styles.pill}><Text style={styles.pillText}>{item.status.replace(/_/g, " ")}</Text></View>
            </View>
            <Text style={styles.cust}>{item.user_name || item.user_phone}</Text>
            <View style={{ flexDirection: "row", justifyContent: "space-between", marginTop: 6 }}>
              <Text style={styles.meta}>{item.items.length} items • {item.payment_method.toUpperCase()}</Text>
              <Text style={styles.total}>{formatINR(item.total)}</Text>
            </View>
          </Pressable>
        )}
        ListEmptyComponent={<Text style={{ textAlign: "center", color: theme.colors.onMuted, marginTop: 40 }}>No orders</Text>}
      />
    </View>
  );
}

const styles = StyleSheet.create({
  header: { paddingBottom: 12, backgroundColor: theme.colors.surface2, borderBottomWidth: 1, borderBottomColor: theme.colors.divider },
  title: { paddingHorizontal: 16, fontSize: 22, fontWeight: "800", color: theme.colors.on },
  chip: { paddingHorizontal: 14, paddingVertical: 7, borderRadius: 999, backgroundColor: theme.colors.surface3, flexShrink: 0 },
  chipActive: { backgroundColor: theme.colors.brand },
  chipText: { fontSize: 13, fontWeight: "700", color: theme.colors.on },
  card: { padding: 14, backgroundColor: theme.colors.surface2, borderRadius: 12, borderWidth: 1, borderColor: theme.colors.border },
  oid: { fontSize: 14, fontWeight: "800", color: theme.colors.on },
  pill: { paddingHorizontal: 10, paddingVertical: 3, borderRadius: 999, backgroundColor: theme.colors.brandLight },
  pillText: { fontSize: 11, fontWeight: "800", color: theme.colors.brand, textTransform: "uppercase" },
  cust: { fontSize: 14, fontWeight: "700", color: theme.colors.on, marginTop: 6 },
  meta: { fontSize: 12, color: theme.colors.onMuted },
  total: { fontSize: 15, fontWeight: "800", color: theme.colors.brand },
});
