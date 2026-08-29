import { Ionicons } from "@expo/vector-icons";
import { useRouter, useFocusEffect } from "expo-router";
import { useCallback, useState } from "react";
import { FlatList, Pressable, ScrollView, StyleSheet, Text, View } from "react-native";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import { api } from "@/src/lib/api";
import { theme, formatINR } from "@/src/lib/theme";

const TABS = [
  { key: "active", label: "Active" },
  { key: "delivered", label: "Delivered" },
];

export default function Deliveries() {
  const insets = useSafeAreaInsets();
  const router = useRouter();
  const [tab, setTab] = useState("active");
  const [orders, setOrders] = useState<any[]>([]);

  useFocusEffect(useCallback(() => { api.orders().then(setOrders).catch(() => {}); }, []));

  const filtered = orders.filter((o) => tab === "active" ? ["confirmed", "preparing", "packed", "out_for_delivery"].includes(o.status) : o.status === "delivered");

  return (
    <View style={{ flex: 1, backgroundColor: theme.colors.surface }}>
      <View style={[styles.header, { paddingTop: insets.top + 12 }]}>
        <Text style={styles.title}>My Deliveries</Text>
        <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={{ paddingHorizontal: 16, gap: 8, paddingTop: 12 }}>
          {TABS.map((t) => (
            <Pressable key={t.key} onPress={() => setTab(t.key)} style={[styles.chip, tab === t.key && styles.chipActive]} testID={`del-tab-${t.key}`}>
              <Text style={[styles.chipText, tab === t.key && { color: "#fff" }]}>{t.label}</Text>
            </Pressable>
          ))}
        </ScrollView>
      </View>
      <FlatList
        data={filtered}
        keyExtractor={(i) => i.id}
        contentContainerStyle={{ padding: 16, gap: 10, paddingBottom: 100 + insets.bottom }}
        renderItem={({ item }) => (
          <Pressable style={styles.card} onPress={() => router.push({ pathname: "/(delivery)/order/[id]", params: { id: item.id } })}>
            <View style={{ flexDirection: "row", justifyContent: "space-between" }}>
              <Text style={styles.oid}>#{item.order_number}</Text>
              <Text style={styles.total}>{formatINR(item.total)}</Text>
            </View>
            <Text style={styles.cust}>{item.user_name || item.user_phone}</Text>
            <Text style={styles.addr}>{item.address.village} - {item.address.pincode}</Text>
          </Pressable>
        )}
        ListEmptyComponent={<Text style={{ textAlign: "center", color: theme.colors.onMuted, marginTop: 40 }}>No {tab} deliveries</Text>}
      />
    </View>
  );
}

const styles = StyleSheet.create({
  header: { paddingBottom: 12, backgroundColor: theme.colors.surface2, borderBottomWidth: 1, borderBottomColor: theme.colors.divider },
  title: { paddingHorizontal: 16, fontSize: 22, fontWeight: "800", color: theme.colors.on },
  chip: { paddingHorizontal: 16, paddingVertical: 8, borderRadius: 999, backgroundColor: theme.colors.surface3, flexShrink: 0 },
  chipActive: { backgroundColor: theme.colors.brand },
  chipText: { fontSize: 14, fontWeight: "700", color: theme.colors.on },
  card: { padding: 14, backgroundColor: theme.colors.surface2, borderRadius: 14, borderWidth: 1, borderColor: theme.colors.border },
  oid: { fontSize: 14, fontWeight: "800", color: theme.colors.on },
  total: { fontSize: 15, fontWeight: "800", color: theme.colors.brand },
  cust: { fontSize: 15, fontWeight: "700", color: theme.colors.on, marginTop: 6 },
  addr: { fontSize: 13, color: theme.colors.onMuted, marginTop: 2 },
});
