import { Ionicons } from "@expo/vector-icons";
import { Image } from "expo-image";
import { useRouter } from "expo-router";
import { useCallback, useEffect, useState } from "react";
import {
  ActivityIndicator,
  FlatList,
  Pressable,
  RefreshControl,
  ScrollView,
  StyleSheet,
  Text,
  View,
} from "react-native";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import { api } from "@/src/lib/api";
import { useCart } from "@/src/lib/cart";
import { theme, formatINR } from "@/src/lib/theme";
import ProductCard from "@/src/components/ProductCard";
import CartBar from "@/src/components/CartBar";
import { CARD_H_W, CAT_CARD_W, isSmall, SCREEN_WIDTH } from "@/src/utils/responsive";

const SECTIONS = [
  { key: "food", label: "Food", icon: "restaurant" as const },
  { key: "essentials", label: "Daily Essentials", icon: "basket" as const },
  { key: "others", label: "Others", icon: "cube" as const },
];

export default function Home() {
  const router = useRouter();
  const insets = useSafeAreaInsets();
  const { count } = useCart();
  const [section, setSection] = useState("essentials");
  const [categories, setCategories] = useState<any[]>([]);
  const [featured, setFeatured] = useState<any[]>([]);
  const [bestsellers, setBestsellers] = useState<any[]>([]);
  const [all, setAll] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [refresh, setRefresh] = useState(false);

  const load = useCallback(async () => {
    setLoading(true);
    try {
      const [cats, feat, best, prods] = await Promise.all([
        api.categories(section),
        api.products({ section, featured: true, limit: 10 }),
        api.products({ section, bestseller: true, limit: 10 }),
        api.products({ section, limit: 20 }),
      ]);
      setCategories(cats);
      setFeatured(feat);
      setBestsellers(best);
      setAll(prods);
    } catch (e) {
      console.log("load err", e);
    } finally {
      setLoading(false);
    }
  }, [section]);

  useEffect(() => {
    load();
  }, [load]);

  const onRefresh = async () => {
    setRefresh(true);
    await load();
    setRefresh(false);
  };

  // Bottom padding = tab bar (49) + safe area + cart bar (when visible)
  const contentPaddingBottom = 49 + insets.bottom + (count > 0 ? 72 : 16);
  // Banner image size: responsive
  const bannerImgSize = Math.min(Math.round(SCREEN_WIDTH * 0.22), 96);

  return (
    <View style={{ flex: 1, backgroundColor: theme.colors.surface }}>
      {/* Sticky Header */}
      <View style={[styles.header, { paddingTop: insets.top + 8 }]}>
        <View style={styles.locRow}>
          <Ionicons name="location" size={18} color={theme.colors.brand} />
          <View style={{ flex: 1, marginLeft: 6, minWidth: 0 }}>
            <Text style={styles.locLabel}>Delivering to</Text>
            <Text style={styles.locVal} numberOfLines={1}>Village Core • 30 min</Text>
          </View>
          <Pressable
            onPress={() => router.push("/(customer)/profile")}
            testID="profile-quick"
            style={styles.profileBtn}
            hitSlop={8}
          >
            <Ionicons name="person-circle" size={30} color={theme.colors.brand} />
          </Pressable>
        </View>

        <Pressable
          style={styles.searchBar}
          onPress={() => router.push("/(customer)/search")}
          testID="search-open"
        >
          <Ionicons name="search" size={18} color={theme.colors.onMuted} />
          <Text style={styles.searchPh} numberOfLines={1}>Search "atta", "milk", दूध...</Text>
        </Pressable>

        <ScrollView
          horizontal
          showsHorizontalScrollIndicator={false}
          contentContainerStyle={styles.chipRow}
        >
          {SECTIONS.map((s) => {
            const active = section === s.key;
            return (
              <Pressable
                key={s.key}
                onPress={() => setSection(s.key)}
                style={[styles.chip, active && styles.chipActive]}
                testID={`section-${s.key}`}
              >
                <Ionicons name={s.icon} size={15} color={active ? "#fff" : theme.colors.on} />
                <Text style={[styles.chipText, active && { color: "#fff" }]}>{s.label}</Text>
              </Pressable>
            );
          })}
        </ScrollView>
      </View>

      <ScrollView
        contentContainerStyle={{ paddingBottom: contentPaddingBottom }}
        refreshControl={
          <RefreshControl refreshing={refresh} onRefresh={onRefresh} tintColor={theme.colors.brand} />
        }
      >
        {loading ? (
          <View style={{ padding: 60, alignItems: "center" }}>
            <ActivityIndicator size="large" color={theme.colors.brand} />
          </View>
        ) : (
          <>
            {/* Promo Banner */}
            <View style={styles.banner}>
              <View style={{ flex: 1, minWidth: 0 }}>
                <Text style={styles.bannerTitle}>Fresh & Fast</Text>
                <Text style={styles.bannerSub} numberOfLines={1}>Delivery in 30 mins</Text>
                <View style={styles.bannerBadge}>
                  <Text style={styles.bannerBadgeText}>Use WELCOME50</Text>
                </View>
              </View>
              <Image
                source={{ uri: "https://images.unsplash.com/photo-1610348725531-843dff563e2c?w=400" }}
                style={[styles.bannerImg, { width: bannerImgSize, height: bannerImgSize }]}
              />
            </View>

            {/* Categories */}
            {categories.length > 0 && (
              <Section title="Shop by Category">
                {/* Use a flat row-wrap grid with exact per-card width */}
                <View style={styles.catGrid}>
                  {categories.map((c) => (
                    <Pressable
                      key={c.id}
                      style={[styles.catCard, { width: CAT_CARD_W }]}
                      onPress={() =>
                        router.push({ pathname: "/(customer)/categories", params: { cat: c.id } })
                      }
                      testID={`cat-${c.id}`}
                    >
                      <Image
                        source={{ uri: c.image }}
                        style={[styles.catImg, { width: CAT_CARD_W - 12, height: CAT_CARD_W - 12 }]}
                        contentFit="cover"
                      />
                      <Text style={styles.catText} numberOfLines={2}>{c.name}</Text>
                    </Pressable>
                  ))}
                </View>
              </Section>
            )}

            {/* Featured */}
            {featured.length > 0 && (
              <Section title="Today's Offers">
                <FlatList
                  data={featured}
                  horizontal
                  showsHorizontalScrollIndicator={false}
                  contentContainerStyle={{ paddingHorizontal: 16, gap: 10 }}
                  keyExtractor={(i) => i.id}
                  renderItem={({ item }) => <ProductCard product={item} width={CARD_H_W} />}
                />
              </Section>
            )}

            {/* Bestsellers */}
            {bestsellers.length > 0 && (
              <Section title="Best Sellers">
                <FlatList
                  data={bestsellers}
                  horizontal
                  showsHorizontalScrollIndicator={false}
                  contentContainerStyle={{ paddingHorizontal: 16, gap: 10 }}
                  keyExtractor={(i) => i.id}
                  renderItem={({ item }) => <ProductCard product={item} width={CARD_H_W} />}
                />
              </Section>
            )}

            {/* All — 2-col grid, flex-based */}
            {all.length > 0 && (
              <Section title="Recommended for You">
                <View style={styles.grid}>
                  {all.map((p) => (
                    <View key={p.id} style={styles.gridItem}>
                      <ProductCard product={p} />
                    </View>
                  ))}
                </View>
              </Section>
            )}
          </>
        )}
      </ScrollView>

      <CartBar />
    </View>
  );
}

function Section({ title, children }: any) {
  return (
    <View style={{ marginTop: 20 }}>
      <Text style={styles.sectionTitle}>{title}</Text>
      {children}
    </View>
  );
}

const GRID_GAP = 8;
const GRID_H_PAD = 16;
const GRID_ITEM_W = Math.floor((SCREEN_WIDTH - GRID_H_PAD * 2 - GRID_GAP) / 2);

const styles = StyleSheet.create({
  header: {
    backgroundColor: theme.colors.surface2,
    paddingBottom: 4,
    borderBottomWidth: 1,
    borderBottomColor: theme.colors.divider,
  },
  locRow: {
    flexDirection: "row",
    alignItems: "center",
    paddingHorizontal: 16,
    paddingVertical: 6,
  },
  locLabel: { fontSize: 11, color: theme.colors.onMuted },
  locVal: { fontSize: 14, fontWeight: "700", color: theme.colors.on },
  profileBtn: { padding: 4, flexShrink: 0 },
  searchBar: {
    marginHorizontal: 16,
    marginTop: 4,
    marginBottom: 8,
    backgroundColor: theme.colors.surface3,
    borderRadius: 12,
    paddingHorizontal: 12,
    paddingVertical: 10,
    flexDirection: "row",
    alignItems: "center",
    gap: 8,
  },
  searchPh: { color: theme.colors.onMuted, fontSize: 14, flex: 1 },
  chipRow: { paddingHorizontal: 16, gap: 8, paddingBottom: 8 },
  chip: {
    flexDirection: "row",
    alignItems: "center",
    gap: 5,
    paddingHorizontal: 12,
    paddingVertical: 7,
    borderRadius: 999,
    backgroundColor: theme.colors.surface3,
    flexShrink: 0,
  },
  chipActive: { backgroundColor: theme.colors.brand },
  chipText: { fontSize: 13, fontWeight: "700", color: theme.colors.on },
  banner: {
    marginHorizontal: 16,
    marginTop: 14,
    borderRadius: 18,
    overflow: "hidden",
    backgroundColor: theme.colors.brandLight,
    padding: 14,
    flexDirection: "row",
    alignItems: "center",
    ...theme.shadow.card,
  },
  bannerTitle: { fontSize: 20, fontWeight: "800", color: theme.colors.brand },
  bannerSub: { fontSize: 13, color: theme.colors.on, marginTop: 3 },
  bannerBadge: {
    backgroundColor: theme.colors.brand,
    alignSelf: "flex-start",
    paddingHorizontal: 8,
    paddingVertical: 5,
    borderRadius: 999,
    marginTop: 8,
  },
  bannerBadgeText: { color: "#fff", fontSize: 11, fontWeight: "700" },
  bannerImg: { borderRadius: 14, marginLeft: 10, flexShrink: 0 },
  sectionTitle: {
    fontSize: 16,
    fontWeight: "800",
    color: theme.colors.on,
    marginHorizontal: 16,
    marginBottom: 10,
  },
  catGrid: {
    flexDirection: "row",
    flexWrap: "wrap",
    paddingHorizontal: 12,
    gap: 4,
  },
  catCard: {
    alignItems: "center",
    padding: 6,
  },
  catImg: {
    borderRadius: 14,
    backgroundColor: theme.colors.surface3,
  },
  catText: {
    fontSize: isSmall ? 10 : 11,
    fontWeight: "600",
    color: theme.colors.on,
    marginTop: 5,
    textAlign: "center",
    lineHeight: 14,
  },
  grid: {
    flexDirection: "row",
    flexWrap: "wrap",
    paddingHorizontal: GRID_H_PAD,
    gap: GRID_GAP,
  },
  gridItem: { width: GRID_ITEM_W },
});
