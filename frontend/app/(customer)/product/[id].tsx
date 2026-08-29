import { Ionicons } from "@expo/vector-icons";
import { Image } from "expo-image";
import { useLocalSearchParams, useRouter } from "expo-router";
import { useEffect, useState } from "react";
import { ActivityIndicator, Pressable, ScrollView, StyleSheet, Text, View } from "react-native";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import { api } from "@/src/lib/api";
import { useCart } from "@/src/lib/cart";
import { theme, formatINR } from "@/src/lib/theme";

export default function ProductDetail() {
  const { id } = useLocalSearchParams<{ id: string }>();
  const insets = useSafeAreaInsets();
  const router = useRouter();
  const { items, add, setQty } = useCart();
  const [product, setProduct] = useState<any>(null);

  useEffect(() => { api.product(id as string).then(setProduct); }, [id]);
  if (!product) return <View style={{ flex: 1, backgroundColor: theme.colors.surface, justifyContent: "center" }}><ActivityIndicator color={theme.colors.brand} size="large" /></View>;

  const inCart = items.find((i) => i.product_id === product.id);
  const discount = product.mrp > product.price ? Math.round(((product.mrp - product.price) / product.mrp) * 100) : 0;
  const out = product.stock <= 0;

  return (
    <View style={{ flex: 1, backgroundColor: theme.colors.surface }}>
      <ScrollView contentContainerStyle={{ paddingBottom: 100 + insets.bottom }}>
        <View style={{ paddingTop: insets.top }}>
          <Pressable onPress={() => router.back()} style={styles.back} testID="pd-back">
            <Ionicons name="arrow-back" size={22} color={theme.colors.on} />
          </Pressable>
          <Image source={{ uri: product.image_url }} style={styles.hero} contentFit="cover" />
          {discount > 0 && (
            <View style={styles.discBadge}><Text style={styles.discText}>{discount}% OFF</Text></View>
          )}
        </View>
        <View style={{ padding: 16 }}>
          <Text style={styles.brand}>{product.brand}</Text>
          <Text style={styles.name}>{product.name}</Text>
          <Text style={styles.unit}>{product.unit}</Text>
          <View style={styles.priceRow}>
            <Text style={styles.price}>{formatINR(product.price)}</Text>
            {discount > 0 && <Text style={styles.mrp}>MRP {formatINR(product.mrp)}</Text>}
            {discount > 0 && <Text style={styles.save}>Save {formatINR(product.mrp - product.price)}</Text>}
          </View>
          {out ? (
            <View style={styles.outBadge}><Ionicons name="alert-circle" size={16} color={theme.colors.error} /><Text style={{ color: theme.colors.error, fontWeight: "700" }}>Out of Stock</Text></View>
          ) : (
            <View style={styles.stockBadge}><Ionicons name="checkmark-circle" size={16} color={theme.colors.success} /><Text style={{ color: theme.colors.success, fontWeight: "700" }}>In Stock ({product.stock} left)</Text></View>
          )}
          <View style={styles.section}>
            <Text style={styles.sectionTitle}>Description</Text>
            <Text style={styles.desc}>{product.description || `Enjoy fresh, quality ${product.name} from ${product.brand}. Sourced daily and delivered in 30 minutes.`}</Text>
          </View>
          <View style={styles.info}>
            <InfoRow k="Brand" v={product.brand} />
            <InfoRow k="Unit" v={product.unit} />
            <InfoRow k="Category" v={product.category_name} />
          </View>
        </View>
      </ScrollView>
      <View style={[styles.footer, { paddingBottom: insets.bottom + 12 }]}>
        {out ? (
          <View style={[styles.cta, { backgroundColor: theme.colors.surface3 }]}>
            <Text style={{ color: theme.colors.onMuted, fontWeight: "800", fontSize: 16 }}>Out of Stock</Text>
          </View>
        ) : inCart ? (
          <View style={styles.qtyRow}>
            <Pressable onPress={() => setQty(product.id, inCart.quantity - 1)} style={styles.qBtn} testID="pd-dec"><Ionicons name="remove" size={22} color="#fff" /></Pressable>
            <Text style={styles.qTxt}>{inCart.quantity} in cart</Text>
            <Pressable onPress={() => setQty(product.id, inCart.quantity + 1)} style={styles.qBtn} testID="pd-inc"><Ionicons name="add" size={22} color="#fff" /></Pressable>
          </View>
        ) : (
          <Pressable style={styles.cta} onPress={() => add(product)} testID="pd-add">
            <Ionicons name="basket" size={22} color="#fff" />
            <Text style={styles.ctaText}>Add to Cart</Text>
          </Pressable>
        )}
      </View>
    </View>
  );
}

function InfoRow({ k, v }: any) {
  return <View style={styles.infoRow}><Text style={styles.infoK}>{k}</Text><Text style={styles.infoV}>{v}</Text></View>;
}

const styles = StyleSheet.create({
  back: { position: "absolute", top: 8, left: 12, zIndex: 10, width: 40, height: 40, borderRadius: 20, backgroundColor: "rgba(255,255,255,0.9)", alignItems: "center", justifyContent: "center" },
  hero: { width: "100%", aspectRatio: 1, backgroundColor: theme.colors.surface3 },
  discBadge: { position: "absolute", top: 16, right: 16, backgroundColor: theme.colors.success, paddingHorizontal: 10, paddingVertical: 6, borderRadius: 8 },
  discText: { color: "#fff", fontSize: 12, fontWeight: "800" },
  brand: { color: theme.colors.onMuted, fontSize: 14, fontWeight: "600" },
  name: { fontSize: 22, fontWeight: "800", color: theme.colors.on, marginTop: 4 },
  unit: { fontSize: 14, color: theme.colors.onMuted, marginTop: 4 },
  priceRow: { flexDirection: "row", alignItems: "center", gap: 10, marginTop: 12, flexWrap: "wrap" },
  price: { fontSize: 26, fontWeight: "800", color: theme.colors.on },
  mrp: { fontSize: 14, color: theme.colors.onMuted, textDecorationLine: "line-through" },
  save: { fontSize: 13, color: theme.colors.success, fontWeight: "800", backgroundColor: theme.colors.success + "20", paddingHorizontal: 8, paddingVertical: 4, borderRadius: 6 },
  outBadge: { flexDirection: "row", alignItems: "center", gap: 6, marginTop: 12, backgroundColor: "#FFEBEE", padding: 8, borderRadius: 8, alignSelf: "flex-start" },
  stockBadge: { flexDirection: "row", alignItems: "center", gap: 6, marginTop: 12, backgroundColor: "#E8F5E9", padding: 8, borderRadius: 8, alignSelf: "flex-start" },
  section: { marginTop: 20 },
  sectionTitle: { fontSize: 16, fontWeight: "800", color: theme.colors.on, marginBottom: 6 },
  desc: { fontSize: 14, color: theme.colors.on, lineHeight: 20 },
  info: { marginTop: 16, backgroundColor: theme.colors.surface3, borderRadius: 12, padding: 12 },
  infoRow: { flexDirection: "row", justifyContent: "space-between", paddingVertical: 6 },
  infoK: { color: theme.colors.onMuted, fontSize: 14 },
  infoV: { color: theme.colors.on, fontWeight: "700", fontSize: 14 },
  footer: { position: "absolute", left: 0, right: 0, bottom: 0, padding: 12, backgroundColor: theme.colors.surface2, borderTopWidth: 1, borderTopColor: theme.colors.divider },
  cta: { backgroundColor: theme.colors.brand, borderRadius: 14, paddingVertical: 16, alignItems: "center", justifyContent: "center", flexDirection: "row", gap: 8 },
  ctaText: { color: "#fff", fontSize: 17, fontWeight: "800" },
  qtyRow: { flexDirection: "row", alignItems: "center", justifyContent: "space-between", backgroundColor: theme.colors.brand, borderRadius: 14, paddingHorizontal: 20, paddingVertical: 12 },
  qBtn: { padding: 6, backgroundColor: "rgba(255,255,255,0.2)", borderRadius: 8 },
  qTxt: { color: "#fff", fontSize: 16, fontWeight: "800" },
});
