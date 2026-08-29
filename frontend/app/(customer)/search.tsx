import { Ionicons } from "@expo/vector-icons";
import { useEffect, useState } from "react";
import { FlatList, Pressable, ScrollView, StyleSheet, Text, TextInput, View } from "react-native";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import { api } from "@/src/lib/api";
import { theme } from "@/src/lib/theme";
import ProductCard from "@/src/components/ProductCard";
import CartBar from "@/src/components/CartBar";

const POPULAR = ["Atta", "Milk", "Rice", "Oil", "Ghee", "Bread", "Sugar", "Tea", "आटा", "दूध"];

export default function Search() {
  const insets = useSafeAreaInsets();
  const [q, setQ] = useState("");
  const [results, setResults] = useState<any[]>([]);
  const [sort, setSort] = useState<string | undefined>();
  const [debounced, setDebounced] = useState("");

  useEffect(() => {
    const t = setTimeout(() => setDebounced(q), 250);
    return () => clearTimeout(t);
  }, [q]);

  useEffect(() => {
    if (debounced.trim().length === 0) { setResults([]); return; }
    api.products({ q: debounced, sort, limit: 50 }).then(setResults);
  }, [debounced, sort]);

  return (
    <View style={{ flex: 1, backgroundColor: theme.colors.surface }}>
      <View style={[styles.header, { paddingTop: insets.top + 8 }]}>
        <View style={styles.searchBox}>
          <Ionicons name="search" size={20} color={theme.colors.onMuted} />
          <TextInput
            value={q}
            onChangeText={setQ}
            placeholder="Search products, brands, दूध, चावल..."
            placeholderTextColor={theme.colors.onMuted}
            style={styles.input}
            autoFocus
            testID="search-input"
          />
          {q ? (
            <Pressable onPress={() => setQ("")} testID="clear-search">
              <Ionicons name="close-circle" size={20} color={theme.colors.onMuted} />
            </Pressable>
          ) : null}
        </View>
        {results.length > 0 && (
          <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={{ paddingHorizontal: 16, gap: 8, paddingBottom: 8 }}>
            {[
              { k: undefined, l: "Relevance" },
              { k: "price_asc", l: "Price ↑" },
              { k: "price_desc", l: "Price ↓" },
              { k: "popularity", l: "Popular" },
            ].map((s) => {
              const active = sort === s.k;
              return (
                <Pressable key={s.l} onPress={() => setSort(s.k)} style={[styles.sortChip, active && { backgroundColor: theme.colors.brand }]} testID={`sort-${s.l}`}>
                  <Text style={[styles.sortText, active && { color: "#fff" }]}>{s.l}</Text>
                </Pressable>
              );
            })}
          </ScrollView>
        )}
      </View>

      {debounced.length === 0 ? (
        <ScrollView contentContainerStyle={{ padding: 16 }}>
          <Text style={styles.h}>Popular searches</Text>
          <View style={styles.chipsWrap}>
            {POPULAR.map((p) => (
              <Pressable key={p} onPress={() => setQ(p)} style={styles.chip} testID={`popular-${p}`}>
                <Ionicons name="trending-up" size={14} color={theme.colors.brand} />
                <Text style={styles.chipText}>{p}</Text>
              </Pressable>
            ))}
          </View>
        </ScrollView>
      ) : (
        <FlatList
          data={results}
          keyExtractor={(i) => i.id}
          numColumns={2}
          columnWrapperStyle={{ gap: 8, paddingHorizontal: 8 }}
          contentContainerStyle={{ paddingVertical: 8, gap: 8, paddingBottom: 100 + insets.bottom }}
          renderItem={({ item }) => <View style={{ flex: 1 }}><ProductCard product={item} /></View>}
          ListEmptyComponent={<Text style={styles.empty}>No products found for "{debounced}"</Text>}
        />
      )}
      <CartBar />
    </View>
  );
}

const styles = StyleSheet.create({
  header: { backgroundColor: theme.colors.surface2, borderBottomWidth: 1, borderBottomColor: theme.colors.divider },
  searchBox: {
    flexDirection: "row", alignItems: "center", gap: 8, marginHorizontal: 16, marginBottom: 10,
    backgroundColor: theme.colors.surface3, borderRadius: 14, paddingHorizontal: 14, paddingVertical: 10,
  },
  input: { flex: 1, fontSize: 16, color: theme.colors.on },
  sortChip: { paddingHorizontal: 12, paddingVertical: 6, borderRadius: 999, backgroundColor: theme.colors.surface3, flexShrink: 0 },
  sortText: { fontSize: 13, fontWeight: "700", color: theme.colors.on },
  h: { fontSize: 18, fontWeight: "800", color: theme.colors.on, marginBottom: 12 },
  chipsWrap: { flexDirection: "row", flexWrap: "wrap", gap: 8 },
  chip: {
    flexDirection: "row", alignItems: "center", gap: 4, backgroundColor: theme.colors.brandLight,
    paddingHorizontal: 14, paddingVertical: 10, borderRadius: 999,
  },
  chipText: { color: theme.colors.brand, fontWeight: "700", fontSize: 14 },
  empty: { textAlign: "center", color: theme.colors.onMuted, marginTop: 40, fontSize: 15 },
});
