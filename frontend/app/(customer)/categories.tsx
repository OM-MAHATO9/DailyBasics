import { Ionicons } from "@expo/vector-icons";
import { useLocalSearchParams, useRouter } from "expo-router";
import { useEffect, useState } from "react";
import { ActivityIndicator, FlatList, Pressable, ScrollView, StyleSheet, Text, View } from "react-native";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import { api } from "@/src/lib/api";
import { theme } from "@/src/lib/theme";
import ProductCard from "@/src/components/ProductCard";
import CartBar from "@/src/components/CartBar";
import { useCart } from "@/src/lib/cart";

export default function Categories() {
  const params = useLocalSearchParams<{ cat?: string }>();
  const insets = useSafeAreaInsets();
  const { count } = useCart();
  const [cats, setCats] = useState<any[]>([]);
  const [selected, setSelected] = useState<string | null>(null);
  const [products, setProducts] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    (async () => {
      const c = await api.categories();
      setCats(c);
      const initial = (params.cat as string) || c[0]?.id;
      setSelected(initial);
    })();
  }, []);

  useEffect(() => {
    if (!selected) return;
    setLoading(true);
    api.products({ category_id: selected, limit: 100 }).then((p) => { setProducts(p); setLoading(false); });
  }, [selected]);

  return (
    <View style={{ flex: 1, backgroundColor: theme.colors.surface }}>
      <View style={[styles.header, { paddingTop: insets.top + 12 }]}>
        <Text style={styles.title}>All Categories</Text>
      </View>
      <View style={{ flex: 1, flexDirection: "row" }}>
        <ScrollView style={styles.side} contentContainerStyle={{ paddingBottom: 100 + insets.bottom }}>
          {cats.map((c) => {
            const active = c.id === selected;
            return (
              <Pressable
                key={c.id}
                onPress={() => setSelected(c.id)}
                style={[styles.sideItem, active && styles.sideItemActive]}
                testID={`cat-side-${c.id}`}
              >
                <View style={[styles.sideBar, active && styles.sideBarActive]} />
                <Text style={[styles.sideText, active && styles.sideTextActive]} numberOfLines={2}>{c.name}</Text>
              </Pressable>
            );
          })}
        </ScrollView>
        <View style={{ flex: 1 }}>
          {loading ? (
            <ActivityIndicator size="large" color={theme.colors.brand} style={{ marginTop: 40 }} />
          ) : (
            <FlatList
              data={products}
              keyExtractor={(i) => i.id}
              numColumns={2}
              columnWrapperStyle={{ gap: 8, paddingHorizontal: 8 }}
              contentContainerStyle={{ paddingVertical: 8, paddingBottom: 100 + insets.bottom, gap: 8 }}
              renderItem={({ item }) => <View style={{ flex: 1 }}><ProductCard product={item} /></View>}
              ListEmptyComponent={<Text style={styles.empty}>No products yet</Text>}
            />
          )}
        </View>
      </View>
      <CartBar />
    </View>
  );
}

const styles = StyleSheet.create({
  header: { paddingHorizontal: 16, paddingBottom: 12, backgroundColor: theme.colors.surface2, borderBottomWidth: 1, borderBottomColor: theme.colors.divider },
  title: { fontSize: 22, fontWeight: "800", color: theme.colors.on },
  side: { width: 110, backgroundColor: theme.colors.surface3 },
  sideItem: { paddingVertical: 14, paddingHorizontal: 8, flexDirection: "row", alignItems: "center" },
  sideItemActive: { backgroundColor: theme.colors.surface },
  sideBar: { width: 4, height: 32, borderRadius: 2, backgroundColor: "transparent", marginRight: 6 },
  sideBarActive: { backgroundColor: theme.colors.brand },
  sideText: { fontSize: 12, color: theme.colors.on, fontWeight: "600", flex: 1 },
  sideTextActive: { color: theme.colors.brand, fontWeight: "800" },
  empty: { textAlign: "center", color: theme.colors.onMuted, marginTop: 40, fontSize: 16 },
});
