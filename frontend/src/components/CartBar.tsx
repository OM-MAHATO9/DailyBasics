import { Ionicons } from "@expo/vector-icons";
import { useRouter } from "expo-router";
import { Pressable, StyleSheet, Text, View } from "react-native";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import { useCart } from "@/src/lib/cart";
import { theme, formatINR } from "@/src/lib/theme";

export default function CartBar() {
  const router = useRouter();
  const insets = useSafeAreaInsets();
  const { count, subtotal } = useCart();
  if (count === 0) return null;

  // Cart bar sits above the tab bar (approx 49px) + bottom safe area + 8px gap
  const tabBarHeight = 49;
  const bottomOffset = tabBarHeight + insets.bottom + 8;

  return (
    <View style={[styles.wrap, { bottom: bottomOffset }]} testID="cart-bar">
      <Pressable style={styles.bar} onPress={() => router.push("/(customer)/cart")} testID="cart-bar-btn">
        <View style={styles.leftBox}>
          <Ionicons name="basket" size={20} color="#fff" />
          <View style={{ marginLeft: 8 }}>
            <Text style={styles.count} numberOfLines={1}>
              {count} item{count > 1 ? "s" : ""}
            </Text>
            <Text style={styles.subtotal} numberOfLines={1}>{formatINR(subtotal)}</Text>
          </View>
        </View>
        <View style={styles.rightBox}>
          <Text style={styles.viewCart}>View Cart</Text>
          <Ionicons name="chevron-forward" size={18} color="#fff" />
        </View>
      </Pressable>
    </View>
  );
}

const styles = StyleSheet.create({
  wrap: {
    position: "absolute",
    left: 12,
    right: 12,
    zIndex: 100,
  },
  bar: {
    backgroundColor: theme.colors.brand,
    borderRadius: 14,
    paddingHorizontal: 14,
    paddingVertical: 10,
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    ...theme.shadow.strong,
  },
  leftBox: { flexDirection: "row", alignItems: "center", flex: 1, minWidth: 0 },
  count: { color: "rgba(255,255,255,0.85)", fontSize: 11, fontWeight: "600" },
  subtotal: { color: "#fff", fontSize: 16, fontWeight: "800" },
  rightBox: { flexDirection: "row", alignItems: "center", gap: 3, flexShrink: 0, marginLeft: 8 },
  viewCart: { color: "#fff", fontSize: 14, fontWeight: "800" },
});
