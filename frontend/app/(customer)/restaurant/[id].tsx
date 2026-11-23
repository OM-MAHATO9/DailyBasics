import { Ionicons } from "@expo/vector-icons";
import { Image } from "expo-image";
import { useLocalSearchParams, useRouter } from "expo-router";
import { useEffect, useState } from "react";
import { ActivityIndicator, Pressable, ScrollView, StyleSheet, Text, View } from "react-native";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import { api } from "@/src/lib/api";
import { useCart } from "@/src/lib/cart";
import { theme } from "@/src/lib/theme";
import ProductCard from "@/src/components/ProductCard";
import CartBar from "@/src/components/CartBar";
import { SCREEN_WIDTH } from "@/src/utils/responsive";

const GAP = 8;
const PAD = 16;
const ITEM_W = Math.floor((SCREEN_WIDTH - PAD * 2 - GAP) / 2);

export default function RestaurantScreen() {
  const { id } = useLocalSearchParams<{ id: string }>();
  const router = useRouter();
  const insets = useSafeAreaInsets();
  const { count } = useCart();
  const [rest, setRest] = useState<any>(null);
  const [menu, setMenu] = useState<any[]>([]);
  const [error, setError] = useState("");

  useEffect(() => {
    setError("");
    Promise.all([api.restaurant(id as string), api.products({ restaurant_id: id, limit: 200 })])
      .then(([r, items]) => { setRest(r); setMenu(items); })
      .catch((e) => setError(e.message || "Could not load this restaurant"));
  }, [id]);

  if (error) {
    return (
      <View style={[styles.center, { paddingTop: insets.top }]}>
        <Ionicons name="restaurant-outline" size={40} color={theme.colors.onMuted} />
        <Text style={styles.errorText}>{error}</Text>
        <Pressable onPress={() => router.back()} style={styles.backBtn}><Text style={styles.backBtnText}>Go back</Text></Pressable>
      </View>
    );
  }
  if (!rest) {
    return <View style={styles.center}><ActivityIndicator color={theme.colors.brand} size="large" /></View>;
  }

  return (
    <View style={{ flex: 1, backgroundColor: theme.colors.surface }}>
      <ScrollView contentContainerStyle={{ paddingBottom: 49 + insets.bottom + (count > 0 ? 72 : 16) }}>
        <View style={{ paddingTop: insets.top }}>
          <Pressable onPress={() => router.back()} style={[styles.back, { top: insets.top + 8 }]} testID="rest-back">
            <Ionicons name="arrow-back" size={22} color={theme.colors.on} />
          </Pressable>
          {rest.image_url ? (
            <Image source={{ uri: rest.image_url }} style={styles.hero} contentFit="cover" />
          ) : (
            <View style={[styles.hero, styles.heroEmpty]}><Ionicons name="restaurant" size={48} color={theme.colors.brand} /></View>
          )}
        </View>

        <View style={styles.info}>
          <Text style={styles.name}>{rest.name}</Text>
          <Text style={styles.meta}>{[rest.cuisine, `${rest.eta_minutes} min delivery`].filter(Boolean).join(" · ")}</Text>
          {!!rest.address && <Text style={styles.meta}>{rest.address}</Text>}
          {!!rest.description && <Text style={styles.desc}>{rest.description}</Text>}
          {!rest.is_open && (
            <View style={styles.closed} testID="rest-closed">
              <Ionicons name="time-outline" size={18} color={theme.colors.error} />
              <Text style={styles.closedText}>Closed right now. You can look at the menu, but orders from here can't be placed until it opens.</Text>
            </View>
          )}
        </View>

        <Text style={styles.sectionTitle}>Menu</Text>
        {menu.length === 0 ? (
          <Text style={styles.empty}>No dishes on the menu yet.</Text>
        ) : (
          <View style={styles.grid}>
            {menu.map((p) => (
              <View key={p.id} style={{ width: ITEM_W, opacity: rest.is_open ? 1 : 0.6 }}>
                <ProductCard product={p} />
              </View>
            ))}
          </View>
        )}
      </ScrollView>
      <CartBar />
    </View>
  );
}

const styles = StyleSheet.create({
  center: { flex: 1, alignItems: "center", justifyContent: "center", backgroundColor: theme.colors.surface, padding: 24, gap: 12 },
  errorText: { color: theme.colors.onMuted, textAlign: "center", fontSize: 15 },
  backBtn: { backgroundColor: theme.colors.brand, paddingHorizontal: 18, paddingVertical: 10, borderRadius: 10 },
  backBtnText: { color: "#fff", fontWeight: "700" },
  back: { position: "absolute", left: 12, zIndex: 2, backgroundColor: "#fff", borderRadius: 20, padding: 8 },
  hero: { width: "100%", height: 180, backgroundColor: theme.colors.brandLight },
  heroEmpty: { alignItems: "center", justifyContent: "center" },
  info: { padding: 16, gap: 4 },
  name: { fontSize: 22, fontWeight: "800", color: theme.colors.on },
  meta: { fontSize: 13, color: theme.colors.onMuted },
  desc: { fontSize: 14, color: theme.colors.on, marginTop: 6 },
  closed: { flexDirection: "row", gap: 8, alignItems: "flex-start", backgroundColor: "#FDECEA", borderRadius: 10, padding: 10, marginTop: 10 },
  closedText: { flex: 1, color: theme.colors.error, fontWeight: "600", fontSize: 13 },
  sectionTitle: { fontSize: 18, fontWeight: "800", color: theme.colors.on, paddingHorizontal: PAD, marginBottom: 10 },
  empty: { color: theme.colors.onMuted, paddingHorizontal: PAD },
  grid: { flexDirection: "row", flexWrap: "wrap", paddingHorizontal: PAD, gap: GAP },
});
