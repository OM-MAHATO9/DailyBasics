import { Ionicons } from "@expo/vector-icons";
import { Image } from "expo-image";
import { useRouter } from "expo-router";
import { useCallback, useState } from "react";
import { useFocusEffect } from "expo-router";
import { ActivityIndicator, FlatList, Pressable, StyleSheet, Text, View } from "react-native";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import { api } from "@/src/lib/api";
import { theme, formatINR } from "@/src/lib/theme";

const STATUS_COLOR: Record<string, string> = {
  placed: theme.colors.warning,
  confirmed: theme.colors.warning,
  preparing: theme.colors.warning,
  packed: theme.colors.warning,
  out_for_delivery: theme.colors.brand,
  delivered: theme.colors.success,
  cancelled: theme.colors.error,
};
const STATUS_LABEL: Record<string, string> = {
  placed: "Order Placed",
  confirmed: "Confirmed",
  preparing: "Preparing",
  packed: "Packed",
  out_for_delivery: "Out for Delivery",
  delivered: "Delivered",
  cancelled: "Cancelled",
};

export default function Orders() {
  const router = useRouter();
  const insets = useSafeAreaInsets();
  const [orders, setOrders] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);

  useFocusEffect(useCallback(() => {
    setLoading(true);
    api.orders().then((o) => { setOrders(o); setLoading(false); }).catch(() => setLoading(false));
  }, []));

  return (
    <View style={{ flex: 1, backgroundColor: theme.colors.surface }}>
      <View style={[styles.header, { paddingTop: insets.top + 12 }]}>
        <Text style={styles.title}>My Orders</Text>
      </View>
      {loading ? (
        <ActivityIndicator size="large" color={theme.colors.brand} style={{ marginTop: 40 }} />
      ) : (
        <FlatList
          data={orders}
          keyExtractor={(o) => o.id}
          contentContainerStyle={{ padding: 16, paddingBottom: 24 + insets.bottom, gap: 12 }}
          renderItem={({ item }) => (
            <Pressable
              style={styles.card}
              onPress={() => router.push({ pathname: "/(customer)/order/[id]", params: { id: item.id } })}
              testID={`order-${item.id}`}
            >
              <View style={styles.top}>
                <Text style={styles.oid}>#{item.order_number}</Text>
                <View style={[styles.badge, { backgroundColor: (STATUS_COLOR[item.status] || theme.colors.onMuted) + "20" }]}>
                  <Text style={[styles.badgeText, { color: STATUS_COLOR[item.status] || theme.colors.on }]}>
                    {STATUS_LABEL[item.status]}
                  </Text>
                </View>
              </View>
              <View style={styles.body}>
                <View style={{ flexDirection: "row", gap: 8 }}>
                  {item.items.slice(0, 3).map((it: any, i: number) => (
                    <Image key={i} source={{ uri: it.image_url }} style={styles.thumb} />
                  ))}
                </View>
                <Text style={styles.count}>{item.items.length} item{item.items.length > 1 ? "s" : ""}</Text>
              </View>
              <View style={styles.foot}>
                <Text style={styles.total}>{formatINR(item.total)}</Text>
                <Ionicons name="chevron-forward" size={20} color={theme.colors.onMuted} />
              </View>
            </Pressable>
          )}
          ListEmptyComponent={
            <View style={styles.empty}>
              <Ionicons name="receipt-outline" size={64} color={theme.colors.onMuted} />
              <Text style={styles.emptyText}>No orders yet</Text>
              <Text style={styles.emptySub}>Start shopping to see your orders here</Text>
            </View>
          }
        />
      )}
    </View>
  );
}

const styles = StyleSheet.create({
  header: { paddingHorizontal: 16, paddingBottom: 12, backgroundColor: theme.colors.surface2, borderBottomWidth: 1, borderBottomColor: theme.colors.divider },
  title: { fontSize: 22, fontWeight: "800", color: theme.colors.on },
  card: { backgroundColor: theme.colors.surface2, borderRadius: 16, padding: 14, borderWidth: 1, borderColor: theme.colors.border },
  top: { flexDirection: "row", justifyContent: "space-between", alignItems: "center", marginBottom: 10 },
  oid: { fontSize: 14, fontWeight: "700", color: theme.colors.on },
  badge: { paddingHorizontal: 10, paddingVertical: 4, borderRadius: 999 },
  badgeText: { fontSize: 12, fontWeight: "800" },
  body: { flexDirection: "row", justifyContent: "space-between", alignItems: "center", marginBottom: 10 },
  thumb: { width: 44, height: 44, borderRadius: 10, backgroundColor: theme.colors.surface3 },
  count: { fontSize: 13, color: theme.colors.onMuted },
  foot: { flexDirection: "row", justifyContent: "space-between", alignItems: "center", borderTopWidth: 1, borderTopColor: theme.colors.divider, paddingTop: 10 },
  total: { fontSize: 18, fontWeight: "800", color: theme.colors.on },
  empty: { alignItems: "center", marginTop: 80 },
  emptyText: { fontSize: 18, fontWeight: "800", color: theme.colors.on, marginTop: 12 },
  emptySub: { fontSize: 14, color: theme.colors.onMuted, marginTop: 4 },
});
