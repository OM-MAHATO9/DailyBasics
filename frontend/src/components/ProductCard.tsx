import { Ionicons } from "@expo/vector-icons";
import { Image } from "expo-image";
import { useRouter } from "expo-router";
import { Pressable, StyleSheet, Text, View } from "react-native";
import { useCart } from "@/src/lib/cart";
import { theme, formatINR } from "@/src/lib/theme";

export default function ProductCard({ product, width }: { product: any; width?: number | string }) {
  const router = useRouter();
  const { items, add, setQty } = useCart();
  const inCart = items.find((i) => i.product_id === product.id);
  const discount = product.mrp > product.price ? Math.round(((product.mrp - product.price) / product.mrp) * 100) : 0;
  const out = product.stock <= 0;

  return (
    <Pressable
      onPress={() => router.push({ pathname: "/(customer)/product/[id]", params: { id: product.id } })}
      style={[styles.card, width ? { width } : null]}
      testID={`product-${product.id}`}
    >
      <View style={styles.imgWrap}>
        <Image source={{ uri: product.image_url }} style={styles.img} contentFit="cover" transition={200} />
        {discount > 0 && (
          <View style={styles.discBadge}>
            <Text style={styles.discText}>{discount}% OFF</Text>
          </View>
        )}
      </View>
      <View style={{ padding: 10 }}>
        <Text style={styles.name} numberOfLines={2}>{product.name}</Text>
        <Text style={styles.unit}>{product.unit}</Text>
        <View style={styles.priceRow}>
          <View style={{ flex: 1 }}>
            <Text style={styles.price}>{formatINR(product.price)}</Text>
            {discount > 0 && <Text style={styles.mrp}>{formatINR(product.mrp)}</Text>}
          </View>
          {out ? (
            <View style={[styles.addBtn, { backgroundColor: theme.colors.surface3 }]}>
              <Text style={[styles.addText, { color: theme.colors.onMuted }]}>OUT</Text>
            </View>
          ) : inCart ? (
            <View style={styles.qtyWrap}>
              <Pressable onPress={() => setQty(product.id, inCart.quantity - 1)} style={styles.qBtn} testID={`dec-${product.id}`}>
                <Ionicons name="remove" size={16} color="#fff" />
              </Pressable>
              <Text style={styles.qText}>{inCart.quantity}</Text>
              <Pressable onPress={() => setQty(product.id, inCart.quantity + 1)} style={styles.qBtn} testID={`inc-${product.id}`}>
                <Ionicons name="add" size={16} color="#fff" />
              </Pressable>
            </View>
          ) : (
            <Pressable onPress={() => add(product)} style={styles.addBtn} testID={`add-${product.id}`}>
              <Text style={styles.addText}>ADD</Text>
            </Pressable>
          )}
        </View>
      </View>
    </Pressable>
  );
}

const styles = StyleSheet.create({
  card: { backgroundColor: theme.colors.surface2, borderRadius: 16, overflow: "hidden", borderWidth: 1, borderColor: theme.colors.border },
  imgWrap: { position: "relative", backgroundColor: theme.colors.surface3, aspectRatio: 1 },
  img: { width: "100%", height: "100%" },
  discBadge: {
    position: "absolute", top: 8, left: 8, backgroundColor: theme.colors.success,
    paddingHorizontal: 6, paddingVertical: 3, borderRadius: 6,
  },
  discText: { color: "#fff", fontSize: 10, fontWeight: "800" },
  name: { fontSize: 14, fontWeight: "700", color: theme.colors.on, minHeight: 36 },
  unit: { fontSize: 12, color: theme.colors.onMuted, marginTop: 2 },
  priceRow: { flexDirection: "row", alignItems: "center", justifyContent: "space-between", marginTop: 8, gap: 8 },
  price: { fontSize: 15, fontWeight: "800", color: theme.colors.on },
  mrp: { fontSize: 12, color: theme.colors.onMuted, textDecorationLine: "line-through" },
  addBtn: {
    borderWidth: 1.5, borderColor: theme.colors.brand, borderRadius: 8, paddingHorizontal: 14, paddingVertical: 7,
    backgroundColor: theme.colors.surface2,
  },
  addText: { color: theme.colors.brand, fontWeight: "800", fontSize: 13, letterSpacing: 0.5 },
  qtyWrap: { flexDirection: "row", alignItems: "center", backgroundColor: theme.colors.brand, borderRadius: 8, overflow: "hidden" },
  qBtn: { paddingHorizontal: 8, paddingVertical: 6 },
  qText: { color: "#fff", fontWeight: "800", fontSize: 14, minWidth: 20, textAlign: "center" },
});
