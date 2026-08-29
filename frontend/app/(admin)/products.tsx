import { Ionicons } from "@expo/vector-icons";
import { Image } from "expo-image";
import { useFocusEffect } from "expo-router";
import { useCallback, useState } from "react";
import { FlatList, StyleSheet, Text, TextInput, View } from "react-native";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import { api } from "@/src/lib/api";
import { theme, formatINR } from "@/src/lib/theme";

export default function AdminProducts() {
  const insets = useSafeAreaInsets();
  const [products, setProducts] = useState<any[]>([]);
  const [q, setQ] = useState("");

  useFocusEffect(useCallback(() => {
    api.products({ limit: 200 }).then(setProducts).catch(() => {});
  }, []));

  const filtered = q ? products.filter((p) => p.name.toLowerCase().includes(q.toLowerCase())) : products;
  const low = products.filter((p) => p.stock <= 5).length;

  return (
    <View style={{ flex: 1, backgroundColor: theme.colors.surface }}>
      <View style={[styles.header, { paddingTop: insets.top + 12 }]}>
        <View style={{ flexDirection: "row", justifyContent: "space-between", alignItems: "flex-end", paddingHorizontal: 16 }}>
          <Text style={styles.title}>Products</Text>
          <View style={styles.badge}>
            <Ionicons name="alert-circle" size={14} color={theme.colors.error} />
            <Text style={styles.badgeText}>{low} low stock</Text>
          </View>
        </View>
        <View style={styles.searchBox}>
          <Ionicons name="search" size={18} color={theme.colors.onMuted} />
          <TextInput
            value={q}
            onChangeText={setQ}
            placeholder="Search products..."
            placeholderTextColor={theme.colors.onMuted}
            style={styles.input}
            testID="admin-prod-search"
          />
        </View>
      </View>
      <FlatList
        data={filtered}
        keyExtractor={(p) => p.id}
        contentContainerStyle={{ padding: 16, gap: 8, paddingBottom: 100 + insets.bottom }}
        renderItem={({ item }) => {
          const isLow = item.stock <= 5;
          return (
            <View style={[styles.card, isLow && { borderColor: theme.colors.error }]}>
              <Image source={{ uri: item.image_url }} style={styles.img} />
              <View style={{ flex: 1, marginLeft: 10 }}>
                <Text style={styles.name} numberOfLines={2}>{item.name}</Text>
                <Text style={styles.brand}>{item.brand} • {item.unit}</Text>
                <View style={{ flexDirection: "row", alignItems: "center", gap: 8, marginTop: 4 }}>
                  <Text style={styles.price}>{formatINR(item.price)}</Text>
                  <Text style={styles.mrp}>{formatINR(item.mrp)}</Text>
                </View>
              </View>
              <View style={styles.stockBox}>
                <Text style={[styles.stockNum, isLow && { color: theme.colors.error }]}>{item.stock}</Text>
                <Text style={styles.stockLabel}>Stock</Text>
              </View>
            </View>
          );
        }}
      />
    </View>
  );
}

const styles = StyleSheet.create({
  header: { paddingBottom: 12, backgroundColor: theme.colors.surface2, borderBottomWidth: 1, borderBottomColor: theme.colors.divider },
  title: { fontSize: 22, fontWeight: "800", color: theme.colors.on },
  badge: { flexDirection: "row", alignItems: "center", gap: 4, backgroundColor: "#FFEBEE", paddingHorizontal: 10, paddingVertical: 4, borderRadius: 999 },
  badgeText: { color: theme.colors.error, fontSize: 12, fontWeight: "700" },
  searchBox: { flexDirection: "row", alignItems: "center", gap: 8, marginHorizontal: 16, marginTop: 12, backgroundColor: theme.colors.surface3, borderRadius: 12, paddingHorizontal: 12, paddingVertical: 10 },
  input: { flex: 1, fontSize: 15, color: theme.colors.on },
  card: { flexDirection: "row", alignItems: "center", padding: 12, backgroundColor: theme.colors.surface2, borderRadius: 12, borderWidth: 1, borderColor: theme.colors.border },
  img: { width: 56, height: 56, borderRadius: 10, backgroundColor: theme.colors.surface3 },
  name: { fontSize: 14, fontWeight: "700", color: theme.colors.on },
  brand: { fontSize: 12, color: theme.colors.onMuted, marginTop: 2 },
  price: { fontSize: 14, fontWeight: "800", color: theme.colors.on },
  mrp: { fontSize: 12, color: theme.colors.onMuted, textDecorationLine: "line-through" },
  stockBox: { alignItems: "center", padding: 6 },
  stockNum: { fontSize: 20, fontWeight: "800", color: theme.colors.success },
  stockLabel: { fontSize: 10, color: theme.colors.onMuted },
});
