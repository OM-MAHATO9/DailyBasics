import { Ionicons } from "@expo/vector-icons";
import { useRouter } from "expo-router";
import { useEffect, useState } from "react";
import { ActivityIndicator, KeyboardAvoidingView, Platform, Pressable, ScrollView, StyleSheet, Text, TextInput, View } from "react-native";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import { api, auth } from "@/src/lib/api";
import { useCart } from "@/src/lib/cart";
import { theme, formatINR } from "@/src/lib/theme";
import { fetchPaymentConfig, verifyRazorpay } from "@/src/lib/payments";
import RazorpayCheckout from "@/src/components/RazorpayCheckout";

export default function Checkout() {
  const router = useRouter();
  const insets = useSafeAreaInsets();
  const { items, subtotal, clear } = useCart();
  const [addrs, setAddrs] = useState<any[]>([]);
  const [addrId, setAddrId] = useState<string | null>(null);
  const [showForm, setShowForm] = useState(false);
  const [form, setForm] = useState({ label: "Home", house: "", landmark: "", village: "", pincode: "", phone: "", instructions: "" });
  const [couponCode, setCouponCode] = useState("");
  const [couponInfo, setCouponInfo] = useState<any>(null);
  const [deliveryInfo, setDeliveryInfo] = useState<any>(null);
  const [placing, setPlacing] = useState(false);
  const [payMethod, setPayMethod] = useState("cod");
  const [err, setErr] = useState("");
  const [pincodeErr, setPincodeErr] = useState("");
  const [payConfig, setPayConfig] = useState<{ razorpay_enabled: boolean; razorpay_key_id: string | null }>({ razorpay_enabled: false, razorpay_key_id: null });
  const [rzpOrder, setRzpOrder] = useState<any>(null);
  const [rzpUser, setRzpUser] = useState<any>({});
  const [walletBal, setWalletBal] = useState(0);
  const [useWallet, setUseWallet] = useState(false);

  useEffect(() => {
    api.addresses().then((a) => {
      setAddrs(a);
      if (a[0]) { setAddrId(a[0].id); checkPin(a[0].pincode); }
      else setShowForm(true);
    });
    fetchPaymentConfig().then(setPayConfig).catch(() => {});
    auth.getUser().then((u) => setRzpUser(u || {}));
    api.wallet().then((w) => setWalletBal(w.balance || 0)).catch(() => {});
  }, []);

  const checkPin = async (pin: string) => {
    setPincodeErr("");
    try {
      const r = await api.checkDelivery(pin);
      if (!r.serviceable) { setPincodeErr(r.message); setDeliveryInfo(null); }
      else setDeliveryInfo(r);
    } catch {}
  };

  const saveAddr = async () => {
    if (!form.house || !form.village || !form.pincode || !form.phone) { setErr("Fill all required fields"); return; }
    setErr("");
    const a = await api.addAddress(form);
    setAddrs((prev) => [...prev, a]);
    setAddrId(a.id);
    setShowForm(false);
    checkPin(form.pincode);
  };

  const applyCoupon = async () => {
    if (!couponCode) return;
    try {
      const r = await api.applyCoupon(couponCode, subtotal);
      setCouponInfo(r);
      setErr("");
    } catch (e: any) { setErr(e.message); setCouponInfo(null); }
  };

  const deliveryCharge = deliveryInfo ? (couponInfo?.free_delivery ? 0 : deliveryInfo.delivery_charge) : 0;
  const couponDiscount = couponInfo?.discount || 0;
  const subTotalBeforeWallet = subtotal + deliveryCharge - couponDiscount;
  const walletApplied = useWallet ? Math.max(0, Math.min(walletBal, subTotalBeforeWallet - 1)) : 0;
  const total = Math.max(0, subTotalBeforeWallet - walletApplied);

  const placeOrder = async () => {
    if (!addrId) return setErr("Select address");
    if (!deliveryInfo) return setErr("Address not serviceable");
    setPlacing(true); setErr("");
    try {
      const order = await api.placeOrder({
        address_id: addrId,
        items: items.map((i) => ({ product_id: i.product_id, quantity: i.quantity })),
        coupon_code: couponInfo ? couponInfo.code : null,
        payment_method: payMethod,
        use_wallet: useWallet,
      });
      if (payMethod === "online") {
        if (!order.razorpay_enabled) {
          setErr(order.razorpay_message || "Online payment not configured");
          setPlacing(false);
          return;
        }
        setRzpOrder(order);
        setPlacing(false);
        return;
      }
      clear();
      router.replace({ pathname: "/(customer)/order/[id]", params: { id: order.id } });
    } catch (e: any) { setErr(e.message); setPlacing(false); }
  };

  const onRzpSuccess = async (resp: any) => {
    try {
      await verifyRazorpay(rzpOrder.id, resp);
      const orderId = rzpOrder.id;
      setRzpOrder(null);
      clear();
      router.replace({ pathname: "/(customer)/order/[id]", params: { id: orderId } });
    } catch (e: any) {
      setErr(`Payment verify failed: ${e.message}. Order kept — you can retry from Orders.`);
      setRzpOrder(null);
    }
  };
  const onRzpFailure = (r: any) => {
    setErr(`Payment failed: ${r?.description || "Please try again"}. Order kept.`);
    setRzpOrder(null);
  };
  const onRzpDismiss = () => {
    setErr("Payment cancelled. You can retry from your Orders.");
    if (rzpOrder) {
      const orderId = rzpOrder.id;
      setRzpOrder(null);
      clear();
      router.replace({ pathname: "/(customer)/order/[id]", params: { id: orderId } });
    }
  };

  return (
    <View style={{ flex: 1, backgroundColor: theme.colors.surface }}>
      <View style={[styles.header, { paddingTop: insets.top + 12 }]}>
        <Pressable onPress={() => router.back()} testID="ck-back"><Ionicons name="arrow-back" size={24} color={theme.colors.on} /></Pressable>
        <Text style={styles.title}>Checkout</Text>
        <View style={{ width: 24 }} />
      </View>
      <KeyboardAvoidingView style={{ flex: 1 }} behavior={Platform.OS === "ios" ? "padding" : undefined}>
        <ScrollView contentContainerStyle={{ padding: 16, paddingBottom: 160 + insets.bottom }} keyboardShouldPersistTaps="handled">
          <Text style={styles.sec}>Delivery Address</Text>
          {addrs.map((a) => (
            <Pressable
              key={a.id}
              onPress={() => { setAddrId(a.id); checkPin(a.pincode); }}
              style={[styles.addrCard, addrId === a.id && styles.addrActive]}
              testID={`addr-${a.id}`}
            >
              <View style={styles.radio}>{addrId === a.id ? <View style={styles.radioDot} /> : null}</View>
              <View style={{ flex: 1 }}>
                <Text style={styles.addrLabel}>{a.label}</Text>
                <Text style={styles.addrText}>{a.house}, {a.landmark ? `${a.landmark}, ` : ""}{a.village} - {a.pincode}</Text>
                <Text style={styles.addrText}>Phone: {a.phone}</Text>
              </View>
            </Pressable>
          ))}
          {showForm ? (
            <View style={styles.formCard}>
              <Input placeholder="House/Village No. *" value={form.house} onChange={(v) => setForm({ ...form, house: v })} testID="in-house" />
              <Input placeholder="Landmark (e.g., Near Hanuman Mandir)" value={form.landmark} onChange={(v) => setForm({ ...form, landmark: v })} testID="in-landmark" />
              <Input placeholder="Village/Area *" value={form.village} onChange={(v) => setForm({ ...form, village: v })} testID="in-village" />
              <Input placeholder="Pincode *" keyboardType="number-pad" value={form.pincode} onChange={(v) => setForm({ ...form, pincode: v })} testID="in-pincode" />
              <Input placeholder="Phone Number *" keyboardType="number-pad" value={form.phone} onChange={(v) => setForm({ ...form, phone: v })} testID="in-phone" />
              <Input placeholder="Delivery instructions (optional)" value={form.instructions} onChange={(v) => setForm({ ...form, instructions: v })} testID="in-instr" />
              <Pressable style={styles.saveAddr} onPress={saveAddr} testID="save-addr-btn"><Text style={styles.saveAddrText}>Save Address</Text></Pressable>
            </View>
          ) : (
            <Pressable style={styles.addBtn} onPress={() => setShowForm(true)} testID="add-addr-btn">
              <Ionicons name="add-circle" size={20} color={theme.colors.brand} />
              <Text style={styles.addBtnText}>Add New Address</Text>
            </Pressable>
          )}
          {pincodeErr ? <Text style={styles.err}>{pincodeErr}</Text> : null}
          {deliveryInfo && (
            <View style={styles.serviceable}>
              <Ionicons name="checkmark-circle" size={18} color={theme.colors.success} />
              <Text style={{ color: theme.colors.success, fontWeight: "700" }}>Deliverable in {deliveryInfo.eta_minutes} min • {formatINR(deliveryInfo.delivery_charge)} charge</Text>
            </View>
          )}

          <Text style={styles.sec}>Apply Coupon</Text>
          <View style={styles.couponRow}>
            <TextInput
              value={couponCode}
              onChangeText={setCouponCode}
              placeholder="Enter coupon (WELCOME50, SAVE20, FREEDEL)"
              placeholderTextColor={theme.colors.onMuted}
              style={styles.couponInput}
              autoCapitalize="characters"
              testID="coupon-input"
            />
            <Pressable style={styles.applyBtn} onPress={applyCoupon} testID="apply-coupon-btn"><Text style={{ color: "#fff", fontWeight: "800" }}>Apply</Text></Pressable>
          </View>
          {couponInfo && (
            <View style={styles.serviceable}>
              <Ionicons name="gift" size={18} color={theme.colors.success} />
              <Text style={{ color: theme.colors.success, fontWeight: "700" }}>Coupon {couponInfo.code} applied</Text>
            </View>
          )}

          {walletBal > 0 && (
            <>
              <Text style={styles.sec}>DailyBasics Wallet</Text>
              <Pressable style={[styles.payOpt, useWallet && styles.payActive]} onPress={() => setUseWallet(!useWallet)} testID="use-wallet-toggle">
                <Ionicons name="wallet" size={22} color={theme.colors.brand} />
                <View style={{ flex: 1 }}>
                  <Text style={styles.payTitle}>Use Wallet Balance</Text>
                  <Text style={styles.paySub}>You have {formatINR(walletBal)} available</Text>
                </View>
                <View style={[styles.radio, useWallet && { backgroundColor: theme.colors.brand }]}>{useWallet && <Ionicons name="checkmark" size={14} color="#fff" />}</View>
              </Pressable>
            </>
          )}

          <Text style={styles.sec}>Payment Method</Text>
          <Pressable style={[styles.payOpt, payMethod === "cod" && styles.payActive]} onPress={() => setPayMethod("cod")} testID="pay-cod">
            <Ionicons name="cash" size={22} color={theme.colors.brand} />
            <View style={{ flex: 1 }}><Text style={styles.payTitle}>Cash on Delivery</Text><Text style={styles.paySub}>Pay when your order arrives</Text></View>
            <View style={styles.radio}>{payMethod === "cod" && <View style={styles.radioDot} />}</View>
          </Pressable>
          {payConfig.razorpay_enabled ? (
            <Pressable style={[styles.payOpt, payMethod === "online" && styles.payActive]} onPress={() => setPayMethod("online")} testID="pay-online">
              <Ionicons name="qr-code" size={22} color={theme.colors.brand} />
              <View style={{ flex: 1 }}>
                <Text style={styles.payTitle}>UPI / Card / Netbanking</Text>
                <Text style={styles.paySub}>Powered by Razorpay • Instant</Text>
              </View>
              <View style={styles.radio}>{payMethod === "online" && <View style={styles.radioDot} />}</View>
            </Pressable>
          ) : (
            <Pressable style={[styles.payOpt, { opacity: 0.5 }]} disabled testID="pay-online-disabled">
              <Ionicons name="qr-code" size={22} color={theme.colors.onMuted} />
              <View style={{ flex: 1 }}><Text style={styles.payTitle}>UPI / Card / Netbanking</Text><Text style={styles.paySub}>Razorpay keys not configured yet</Text></View>
            </Pressable>
          )}

          <View style={styles.bill}>
            <Text style={styles.billTitle}>Bill Summary</Text>
            <Row k="Item Total" v={formatINR(subtotal)} />
            <Row k="Delivery Charge" v={deliveryCharge === 0 && couponInfo?.free_delivery ? "FREE" : formatINR(deliveryCharge)} />
            {couponDiscount > 0 && <Row k={`Coupon (${couponInfo.code})`} v={`- ${formatINR(couponDiscount)}`} vColor={theme.colors.success} />}
            {walletApplied > 0 && <Row k="Wallet Applied" v={`- ${formatINR(walletApplied)}`} vColor={theme.colors.success} />}
            <View style={{ height: 1, backgroundColor: theme.colors.divider, marginVertical: 8 }} />
            <Row k="Total" v={formatINR(total)} bold />
          </View>

          {err ? <Text style={styles.err}>{err}</Text> : null}
        </ScrollView>

        <View style={[styles.footer, { paddingBottom: insets.bottom + 12 }]}>
          <View style={{ flex: 1 }}>
            <Text style={styles.footTotal}>{formatINR(total)}</Text>
            <Text style={styles.footNote}>{items.length} item{items.length > 1 ? "s" : ""} • {payMethod === "cod" ? "COD" : "UPI / Card"}</Text>
          </View>
          <Pressable
            style={[styles.placeBtn, (!deliveryInfo || placing) && { opacity: 0.5 }]}
            onPress={placeOrder}
            disabled={!deliveryInfo || placing}
            testID="place-order-btn"
          >
            {placing ? <ActivityIndicator color="#fff" /> : <Text style={styles.placeText}>{payMethod === "online" ? "Pay Now" : "Place Order"}</Text>}
          </Pressable>
        </View>
      </KeyboardAvoidingView>
      {rzpOrder && (
        <RazorpayCheckout
          visible={!!rzpOrder}
          order={rzpOrder}
          user={rzpUser}
          onSuccess={onRzpSuccess}
          onFailure={onRzpFailure}
          onDismiss={onRzpDismiss}
        />
      )}
    </View>
  );
}

function Input({ placeholder, value, onChange, keyboardType, testID }: any) {
  return (
    <TextInput
      value={value}
      onChangeText={onChange}
      placeholder={placeholder}
      placeholderTextColor={theme.colors.onMuted}
      keyboardType={keyboardType}
      style={styles.input}
      testID={testID}
    />
  );
}
function Row({ k, v, vColor, bold }: any) {
  return <View style={{ flexDirection: "row", justifyContent: "space-between", paddingVertical: 4 }}>
    <Text style={[{ color: theme.colors.on, fontSize: 14 }, bold && { fontWeight: "800", fontSize: 16 }]}>{k}</Text>
    <Text style={[{ color: theme.colors.on, fontSize: 14, fontWeight: "600" }, vColor && { color: vColor }, bold && { fontWeight: "800", fontSize: 16 }]}>{v}</Text>
  </View>;
}

const styles = StyleSheet.create({
  header: { flexDirection: "row", alignItems: "center", paddingHorizontal: 16, paddingBottom: 12, backgroundColor: theme.colors.surface2, borderBottomWidth: 1, borderBottomColor: theme.colors.divider },
  title: { flex: 1, fontSize: 20, fontWeight: "800", color: theme.colors.on, textAlign: "center" },
  sec: { fontSize: 16, fontWeight: "800", color: theme.colors.on, marginTop: 16, marginBottom: 8 },
  addrCard: { flexDirection: "row", gap: 12, padding: 14, backgroundColor: theme.colors.surface2, borderRadius: 12, borderWidth: 1.5, borderColor: theme.colors.border, marginBottom: 8 },
  addrActive: { borderColor: theme.colors.brand, backgroundColor: theme.colors.brandLight },
  addrLabel: { fontSize: 14, fontWeight: "800", color: theme.colors.on },
  addrText: { fontSize: 13, color: theme.colors.on, marginTop: 2 },
  radio: { width: 22, height: 22, borderRadius: 11, borderWidth: 2, borderColor: theme.colors.brand, alignItems: "center", justifyContent: "center", marginTop: 2 },
  radioDot: { width: 12, height: 12, borderRadius: 6, backgroundColor: theme.colors.brand },
  addBtn: { flexDirection: "row", gap: 8, alignItems: "center", justifyContent: "center", padding: 14, backgroundColor: theme.colors.brandLight, borderRadius: 12 },
  addBtnText: { color: theme.colors.brand, fontWeight: "800", fontSize: 15 },
  formCard: { backgroundColor: theme.colors.surface2, padding: 14, borderRadius: 12, borderWidth: 1, borderColor: theme.colors.border },
  input: { borderWidth: 1, borderColor: theme.colors.border, borderRadius: 10, paddingHorizontal: 12, paddingVertical: 12, fontSize: 15, color: theme.colors.on, marginBottom: 10 },
  saveAddr: { backgroundColor: theme.colors.brand, padding: 12, borderRadius: 10, alignItems: "center", marginTop: 4 },
  saveAddrText: { color: "#fff", fontWeight: "800" },
  err: { color: theme.colors.error, marginTop: 8, fontSize: 14 },
  serviceable: { flexDirection: "row", gap: 6, alignItems: "center", padding: 10, backgroundColor: theme.colors.success + "20", borderRadius: 10, marginTop: 8 },
  couponRow: { flexDirection: "row", gap: 8 },
  couponInput: { flex: 1, borderWidth: 1, borderColor: theme.colors.border, borderRadius: 10, paddingHorizontal: 12, paddingVertical: 12, fontSize: 15, color: theme.colors.on, backgroundColor: theme.colors.surface2 },
  applyBtn: { backgroundColor: theme.colors.brand, paddingHorizontal: 20, justifyContent: "center", borderRadius: 10 },
  payOpt: { flexDirection: "row", alignItems: "center", gap: 12, padding: 14, backgroundColor: theme.colors.surface2, borderRadius: 12, borderWidth: 1.5, borderColor: theme.colors.border, marginBottom: 8 },
  payActive: { borderColor: theme.colors.brand, backgroundColor: theme.colors.brandLight },
  payTitle: { fontSize: 15, fontWeight: "800", color: theme.colors.on },
  paySub: { fontSize: 12, color: theme.colors.onMuted, marginTop: 2 },
  bill: { backgroundColor: theme.colors.surface2, borderRadius: 12, padding: 14, marginTop: 12, borderWidth: 1, borderColor: theme.colors.border },
  billTitle: { fontSize: 16, fontWeight: "800", color: theme.colors.on, marginBottom: 8 },
  footer: { position: "absolute", left: 0, right: 0, bottom: 0, flexDirection: "row", alignItems: "center", gap: 12, padding: 12, backgroundColor: theme.colors.surface2, borderTopWidth: 1, borderTopColor: theme.colors.divider },
  footTotal: { fontSize: 20, fontWeight: "800", color: theme.colors.on },
  footNote: { fontSize: 12, color: theme.colors.onMuted },
  placeBtn: { backgroundColor: theme.colors.brand, paddingHorizontal: 28, paddingVertical: 14, borderRadius: 12 },
  placeText: { color: "#fff", fontSize: 16, fontWeight: "800" },
});
