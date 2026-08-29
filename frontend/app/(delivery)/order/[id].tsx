import { Ionicons } from "@expo/vector-icons";
import { Image } from "expo-image";
import { useLocalSearchParams, useRouter } from "expo-router";
import { useCallback, useState } from "react";
import { useFocusEffect } from "expo-router";
import { ActivityIndicator, KeyboardAvoidingView, Linking, Platform, Pressable, ScrollView, StyleSheet, Text, TextInput, View } from "react-native";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import { api } from "@/src/lib/api";
import { theme, formatINR } from "@/src/lib/theme";

const NEXT: Record<string, { next: string; label: string }> = {
  confirmed: { next: "out_for_delivery", label: "Start Delivery" },
  preparing: { next: "out_for_delivery", label: "Pick Up & Start" },
  packed: { next: "out_for_delivery", label: "Pick Up & Start" },
  out_for_delivery: { next: "delivered", label: "Mark Delivered" },
};

export default function DPOrder() {
  const { id } = useLocalSearchParams<{ id: string }>();
  const insets = useSafeAreaInsets();
  const router = useRouter();
  const [order, setOrder] = useState<any>(null);
  const [otp, setOtp] = useState("");
  const [amount, setAmount] = useState("");
  const [loading, setLoading] = useState(false);
  const [err, setErr] = useState("");

  const load = useCallback(async () => {
    try { const o = await api.order(id as string); setOrder(o); setAmount(String(o.total)); } catch {}
  }, [id]);
  useFocusEffect(useCallback(() => { load(); }, [load]));

  if (!order) return <View style={{ flex: 1, backgroundColor: theme.colors.surface, justifyContent: "center" }}><ActivityIndicator color={theme.colors.brand} size="large" /></View>;

  const step = NEXT[order.status];
  const isDeliver = step?.next === "delivered";

  const advance = async () => {
    setErr(""); setLoading(true);
    try {
      const body: any = { status: step.next };
      if (isDeliver) {
        if (otp.length !== 4) { setErr("Enter 4-digit customer OTP"); setLoading(false); return; }
        body.otp = otp;
        if (order.payment_method === "cod") body.collected_amount = parseFloat(amount);
      }
      await api.updateOrderStatus(id as string, body);
      await load();
    } catch (e: any) { setErr(e.message); } finally { setLoading(false); }
  };

  return (
    <View style={{ flex: 1, backgroundColor: theme.colors.surface }}>
      <View style={[styles.header, { paddingTop: insets.top + 12 }]}>
        <Pressable onPress={() => router.back()}><Ionicons name="arrow-back" size={24} color={theme.colors.on} /></Pressable>
        <Text style={styles.title}>#{order.order_number}</Text>
        <View style={{ width: 24 }} />
      </View>
      <KeyboardAvoidingView style={{ flex: 1 }} behavior={Platform.OS === "ios" ? "padding" : undefined}>
        <ScrollView contentContainerStyle={{ padding: 16, paddingBottom: 200 + insets.bottom }}>
          <View style={styles.statusCard}>
            <Text style={styles.statusLabel}>Status</Text>
            <Text style={styles.statusVal}>{order.status.replace(/_/g, " ").toUpperCase()}</Text>
          </View>

          <View style={styles.card}>
            <Text style={styles.cardTitle}>Customer</Text>
            <Text style={styles.name}>{order.user_name || "Customer"}</Text>
            <View style={styles.callRow}>
              <Text style={styles.phone}>+91 {order.address.phone}</Text>
              <Pressable style={styles.callBtn} onPress={() => Linking.openURL(`tel:+91${order.address.phone}`)} testID="dp-call">
                <Ionicons name="call" size={18} color="#fff" />
              </Pressable>
            </View>
          </View>

          <View style={styles.card}>
            <Text style={styles.cardTitle}>Delivery Address</Text>
            <Text style={styles.addr}>{order.address.house}{order.address.landmark ? `, ${order.address.landmark}` : ""}</Text>
            <Text style={styles.addr}>{order.address.village} - {order.address.pincode}</Text>
            {order.instructions ? <Text style={styles.instr}>📝 {order.instructions}</Text> : null}
          </View>

          <View style={styles.card}>
            <Text style={styles.cardTitle}>Order ({order.items.length} items)</Text>
            {order.items.map((it: any, i: number) => (
              <View key={i} style={{ flexDirection: "row", alignItems: "center", paddingVertical: 6 }}>
                <Image source={{ uri: it.image_url }} style={styles.thumb} />
                <View style={{ flex: 1, marginLeft: 8 }}>
                  <Text style={styles.itemName} numberOfLines={2}>{it.name}</Text>
                  <Text style={styles.itemQty}>Qty: {it.quantity}</Text>
                </View>
                <Text style={styles.itemPrice}>{formatINR(it.line_total)}</Text>
              </View>
            ))}
            <View style={{ height: 1, backgroundColor: theme.colors.divider, marginVertical: 8 }} />
            <View style={{ flexDirection: "row", justifyContent: "space-between" }}>
              <Text style={{ fontSize: 15, fontWeight: "700" }}>Total ({order.payment_method.toUpperCase()})</Text>
              <Text style={{ fontSize: 18, fontWeight: "800", color: theme.colors.brand }}>{formatINR(order.total)}</Text>
            </View>
          </View>

          {isDeliver && (
            <View style={styles.card}>
              <Text style={styles.cardTitle}>Delivery Confirmation</Text>
              <TextInput
                value={otp}
                onChangeText={setOtp}
                placeholder="4-digit customer OTP"
                placeholderTextColor={theme.colors.onMuted}
                keyboardType="number-pad"
                maxLength={4}
                style={styles.input}
                testID="dp-otp-input"
              />
              {order.payment_method === "cod" && (
                <TextInput
                  value={amount}
                  onChangeText={setAmount}
                  placeholder="Cash collected (₹)"
                  placeholderTextColor={theme.colors.onMuted}
                  keyboardType="decimal-pad"
                  style={styles.input}
                  testID="dp-amount"
                />
              )}
            </View>
          )}

          {err ? <Text style={{ color: theme.colors.error, marginBottom: 8 }}>{err}</Text> : null}
        </ScrollView>

        {step && (
          <View style={[styles.footer, { paddingBottom: insets.bottom + 12 }]}>
            <Pressable style={styles.cta} onPress={advance} disabled={loading} testID="dp-advance-btn">
              {loading ? <ActivityIndicator color="#fff" /> : <Text style={styles.ctaText}>{step.label}</Text>}
            </Pressable>
          </View>
        )}
      </KeyboardAvoidingView>
    </View>
  );
}

const styles = StyleSheet.create({
  header: { flexDirection: "row", alignItems: "center", paddingHorizontal: 16, paddingBottom: 12, backgroundColor: theme.colors.surface2, borderBottomWidth: 1, borderBottomColor: theme.colors.divider },
  title: { flex: 1, fontSize: 18, fontWeight: "800", color: theme.colors.on, textAlign: "center" },
  statusCard: { backgroundColor: theme.colors.brandLight, padding: 16, borderRadius: 16, marginBottom: 12 },
  statusLabel: { color: theme.colors.onMuted, fontSize: 12 },
  statusVal: { color: theme.colors.brand, fontSize: 20, fontWeight: "800", marginTop: 4, letterSpacing: 0.5 },
  card: { backgroundColor: theme.colors.surface2, padding: 14, borderRadius: 14, borderWidth: 1, borderColor: theme.colors.border, marginBottom: 12 },
  cardTitle: { fontSize: 14, fontWeight: "800", color: theme.colors.on, marginBottom: 8, textTransform: "uppercase" },
  name: { fontSize: 17, fontWeight: "700", color: theme.colors.on },
  callRow: { flexDirection: "row", alignItems: "center", marginTop: 4 },
  phone: { flex: 1, fontSize: 15, color: theme.colors.on },
  callBtn: { width: 40, height: 40, borderRadius: 20, backgroundColor: theme.colors.success, alignItems: "center", justifyContent: "center" },
  addr: { fontSize: 15, color: theme.colors.on, lineHeight: 22 },
  instr: { fontSize: 13, color: theme.colors.brand, marginTop: 8, fontStyle: "italic" },
  thumb: { width: 40, height: 40, borderRadius: 8, backgroundColor: theme.colors.surface3 },
  itemName: { fontSize: 13, fontWeight: "600", color: theme.colors.on },
  itemQty: { fontSize: 12, color: theme.colors.onMuted, marginTop: 2 },
  itemPrice: { fontSize: 14, fontWeight: "800", color: theme.colors.on },
  input: { borderWidth: 1, borderColor: theme.colors.border, borderRadius: 10, paddingHorizontal: 12, paddingVertical: 12, fontSize: 16, marginBottom: 10, color: theme.colors.on },
  footer: { position: "absolute", left: 0, right: 0, bottom: 0, padding: 12, backgroundColor: theme.colors.surface2, borderTopWidth: 1, borderTopColor: theme.colors.divider },
  cta: { backgroundColor: theme.colors.brand, paddingVertical: 16, borderRadius: 14, alignItems: "center" },
  ctaText: { color: "#fff", fontSize: 17, fontWeight: "800" },
});
