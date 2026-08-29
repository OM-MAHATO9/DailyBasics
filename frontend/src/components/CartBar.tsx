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
  return (
    <View style={[styles.wrap, { bottom: 60 + insets.bottom + 8 }]} testID="cart-bar">
      <Pressable style={styles.bar} onPress={() => router.push("/(customer)/cart")} testID="cart-bar-btn">
        <View style={styles.leftBox}>
          <Ionicons name="basket" size={22} color="#fff" />
          <View style={{ marginLeft: 10 }}>
            <Text style={styles.count}>{count} item{count > 1 ? "s" : ""}</Text>
            <Text style={styles.subtotal}>{formatINR(subtotal)}</Text>
          </View>
        </View>
        <View style={styles.rightBox}>
          <Text style={styles.viewCart}>View Cart</Text>
          <Ionicons name="chevron-forward" size={20} color="#fff" />
        </View>
      </Pressable>
    </View>
  );
}

const styles = StyleSheet.create({
  wrap: { position: "absolute", left: 12, right: 12 },
  bar: {
    backgroundColor: theme.colors.brand, borderRadius: 16, paddingHorizontal: 16, paddingVertical: 12,
    flexDirection: "row", alignItems: "center", justifyContent: "space-between", ...theme.shadow.strong,
  },
  leftBox: { flexDirection: "row", alignItems: "center" },
  count: { color: "rgba(255,255,255,0.85)", fontSize: 12, fontWeight: "600" },
  subtotal: { color: "#fff", fontSize: 18, fontWeight: "800" },
  rightBox: { flexDirection: "row", alignItems: "center", gap: 4 },
  viewCart: { color: "#fff", fontSize: 16, fontWeight: "800" },
});
