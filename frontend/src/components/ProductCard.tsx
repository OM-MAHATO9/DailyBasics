import { Ionicons } from "@expo/vector-icons";
import { Image } from "expo-image";
import { useRouter } from "expo-router";
import { Pressable, StyleSheet, Text, View } from "react-native";
import { useCart } from "@/src/lib/cart";
import { theme, formatINR } from "@/src/lib/theme";
import { CARD_H_W, isSmall } from "@/src/utils/responsive";

export default function ProductCard({ product, width }: { product: any; width?: number | string }) {
  const router = useRouter();
  const { items, add, setQty } = useCart();
  const inCart = items.find((i) => i.product_id === product.id);
  const discount = product.mrp > product.price ? Math.round(((product.mrp - product.price) / product.mrp) * 100) : 0;
  const out = product.stock <= 0;

  // Default to dynamic full-flex width; explicit numeric width overrides
  const cardStyle = width !== undefined ? { width } : { flex: 1 };

  return (
    <Pressable
      onPress={() => router.push({ pathname: "/(customer)/product/[id]", params: { id: product.id } })}
      style={[styles.card, cardStyle]}
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
      <View style={styles.body}>
        <Text style={styles.name} numberOfLines={2}>{product.name}</Text>
        <Text style={styles.unit} numberOfLines={1}>{product.unit}</Text>
        <View style={styles.priceRow}>
          <View style={styles.priceCol}>
            <Text style={styles.price} numberOfLines={1} adjustsFontSizeToFit minimumFontScale={0.8}>
              {formatINR(product.price)}
            </Text>
            {discount > 0 && (
              <Text style={styles.mrp} numberOfLines={1}>{formatINR(product.mrp)}</Text>
            )}
          </View>
          {out ? (
            <View style={[styles.addBtn, styles.addBtnDisabled]}>
              <Text style={[styles.addText, { color: theme.colors.onMuted, fontSize: isSmall ? 10 : 11 }]}>OUT</Text>
            </View>
          ) : inCart ? (
            <View style={styles.qtyWrap}>
              <Pressable
                onPress={() => setQty(product.id, inCart.quantity - 1)}
                style={styles.qBtn}
                testID={`dec-${product.id}`}
                hitSlop={6}
              >
                <Ionicons name="remove" size={isSmall ? 13 : 15} color="#fff" />
              </Pressable>
              <Text style={styles.qText}>{inCart.quantity}</Text>
              <Pressable
                onPress={() => setQty(product.id, inCart.quantity + 1)}
                style={styles.qBtn}
                testID={`inc-${product.id}`}
                hitSlop={6}
              >
                <Ionicons name="add" size={isSmall ? 13 : 15} color="#fff" />
              </Pressable>
            </View>
          ) : (
            <Pressable
              onPress={() => add(product)}
              style={styles.addBtn}
              testID={`add-${product.id}`}
              hitSlop={4}
            >
              <Text style={styles.addText}>ADD</Text>
            </Pressable>
          )}
        </View>
      </View>
    </Pressable>
  );
}

const styles = StyleSheet.create({
  card: {
    backgroundColor: theme.colors.surface2,
    borderRadius: 14,
    overflow: "hidden",
    borderWidth: 1,
    borderColor: theme.colors.border,
  },
  imgWrap: {
    position: "relative",
    backgroundColor: theme.colors.surface3,
    aspectRatio: 1,
    width: "100%",
  },
  img: { width: "100%", height: "100%" },
  discBadge: {
    position: "absolute",
    top: 6,
    left: 6,
    backgroundColor: theme.colors.success,
    paddingHorizontal: 5,
    paddingVertical: 2,
    borderRadius: 5,
  },
  discText: { color: "#fff", fontSize: 9, fontWeight: "800" },
  body: { padding: 8 },
  name: {
    fontSize: isSmall ? 12 : 13,
    fontWeight: "700",
    color: theme.colors.on,
    minHeight: 34,
    lineHeight: 17,
  },
  unit: { fontSize: 11, color: theme.colors.onMuted, marginTop: 2 },
  priceRow: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    marginTop: 6,
    gap: 4,
  },
  priceCol: { flex: 1, minWidth: 0 },
  price: {
    fontSize: isSmall ? 13 : 14,
    fontWeight: "800",
    color: theme.colors.on,
  },
  mrp: {
    fontSize: 11,
    color: theme.colors.onMuted,
    textDecorationLine: "line-through",
  },
  addBtn: {
    borderWidth: 1.5,
    borderColor: theme.colors.brand,
    borderRadius: 7,
    paddingHorizontal: isSmall ? 8 : 10,
    paddingVertical: 5,
    backgroundColor: theme.colors.surface2,
    flexShrink: 0,
  },
  addBtnDisabled: {
    borderColor: theme.colors.border,
    backgroundColor: theme.colors.surface3,
  },
  addText: {
    color: theme.colors.brand,
    fontWeight: "800",
    fontSize: isSmall ? 11 : 12,
    letterSpacing: 0.4,
  },
  qtyWrap: {
    flexDirection: "row",
    alignItems: "center",
    backgroundColor: theme.colors.brand,
    borderRadius: 7,
    overflow: "hidden",
    flexShrink: 0,
  },
  qBtn: { paddingHorizontal: isSmall ? 6 : 7, paddingVertical: 5 },
  qText: {
    color: "#fff",
    fontWeight: "800",
    fontSize: isSmall ? 12 : 13,
    minWidth: 18,
    textAlign: "center",
  },
});
