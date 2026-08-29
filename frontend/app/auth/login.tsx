import { useRouter } from "expo-router";
import { useState } from "react";
import {
  ActivityIndicator,
  KeyboardAvoidingView,
  Platform,
  Pressable,
  ScrollView,
  StyleSheet,
  Text,
  TextInput,
  View,
} from "react-native";
import { Ionicons } from "@expo/vector-icons";
import { LinearGradient } from "expo-linear-gradient";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import { api, auth, Role } from "@/src/lib/api";
import { theme } from "@/src/lib/theme";

type Mode = "role" | "phone" | "otp" | "admin";

export default function Login() {
  const router = useRouter();
  const insets = useSafeAreaInsets();
  const [mode, setMode] = useState<Mode>("role");
  const [role, setRole] = useState<Role>("customer");
  const [phone, setPhone] = useState("");
  const [name, setName] = useState("");
  const [otp, setOtp] = useState("");
  const [mockOtp, setMockOtp] = useState<string | null>(null);
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [loading, setLoading] = useState(false);
  const [err, setErr] = useState("");

  const goRole = (r: Role) => {
    setErr("");
    setRole(r);
    if (r === "admin") setMode("admin");
    else setMode("phone");
  };

  const sendOtp = async () => {
    setErr("");
    if (phone.replace(/\D/g, "").length < 10) return setErr("Enter valid 10-digit mobile");
    setLoading(true);
    try {
      const r = await api.requestOtp(phone, role as any);
      setMockOtp(r.mock_otp ?? null);
      setMode("otp");
    } catch (e: any) {
      setErr(e.message);
    } finally {
      setLoading(false);
    }
  };

  const verifyOtp = async () => {
    setErr("");
    if (otp.length !== 6) return setErr("Enter 6-digit OTP");
    setLoading(true);
    try {
      const r = await api.verifyOtp(phone, otp, role as any, name);
      await auth.save(r.access_token, r.user);
      if (r.role === "customer") router.replace("/(customer)/home");
      else router.replace("/(delivery)/dashboard");
    } catch (e: any) {
      setErr(e.message);
    } finally {
      setLoading(false);
    }
  };

  const adminLogin = async () => {
    setErr("");
    setLoading(true);
    try {
      const r = await api.adminLogin(email, password);
      await auth.save(r.access_token, r.user);
      router.replace("/(admin)/dashboard");
    } catch (e: any) {
      setErr(e.message);
    } finally {
      setLoading(false);
    }
  };

  return (
    <View style={{ flex: 1, backgroundColor: theme.colors.brand }}>
      <LinearGradient colors={[theme.colors.brand, "#BF360C"]} style={StyleSheet.absoluteFill} />
      <KeyboardAvoidingView
        style={{ flex: 1 }}
        behavior={Platform.OS === "ios" ? "padding" : "height"}
      >
        <ScrollView
          contentContainerStyle={{ flexGrow: 1, paddingTop: insets.top + 40, paddingBottom: insets.bottom + 24 }}
          keyboardShouldPersistTaps="handled"
        >
          <View style={styles.hero}>
            <View style={styles.logo}>
              <Ionicons name="basket" size={40} color={theme.colors.brand} />
            </View>
            <Text style={styles.brand}>DailyBasics</Text>
            <Text style={styles.tagline}>Fresh groceries at your doorstep</Text>
          </View>

          <View style={[styles.card, { marginBottom: insets.bottom + 16 }]}>
            {mode === "role" && (
              <>
                <Text style={styles.title}>Welcome</Text>
                <Text style={styles.subtitle}>Choose how you want to log in</Text>
                <RoleButton
                  icon="bag-handle"
                  title="I'm a Customer"
                  desc="Order groceries and food"
                  onPress={() => goRole("customer")}
                  testID="role-customer"
                />
                <RoleButton
                  icon="bicycle"
                  title="I'm a Delivery Partner"
                  desc="Deliver orders and earn"
                  onPress={() => goRole("delivery_partner")}
                  testID="role-delivery"
                />
                <RoleButton
                  icon="storefront"
                  title="I'm the Store Admin"
                  desc="Manage store & orders"
                  onPress={() => goRole("admin")}
                  testID="role-admin"
                />
              </>
            )}

            {mode === "phone" && (
              <>
                <BackBtn onPress={() => setMode("role")} />
                <Text style={styles.title}>Enter mobile</Text>
                <Text style={styles.subtitle}>{role === "customer" ? "We'll send you an OTP" : "Delivery partner login"}</Text>
                {role === "customer" && (
                  <TextInput
                    value={name}
                    onChangeText={setName}
                    placeholder="Your name (optional)"
                    placeholderTextColor={theme.colors.onMuted}
                    style={styles.input}
                    testID="name-input"
                  />
                )}
                <View style={styles.phoneRow}>
                  <Text style={styles.phonePrefix}>+91</Text>
                  <TextInput
                    value={phone}
                    onChangeText={setPhone}
                    keyboardType="number-pad"
                    maxLength={10}
                    placeholder="10-digit mobile number"
                    placeholderTextColor={theme.colors.onMuted}
                    style={[styles.input, { flex: 1, marginTop: 0 }]}
                    testID="phone-input"
                  />
                </View>
                {err ? <Text style={styles.err}>{err}</Text> : null}
                <PrimaryButton loading={loading} title="Send OTP" onPress={sendOtp} testID="send-otp-btn" />
              </>
            )}

            {mode === "otp" && (
              <>
                <BackBtn onPress={() => setMode("phone")} />
                <Text style={styles.title}>Enter OTP</Text>
                <Text style={styles.subtitle}>Sent to +91 {phone}</Text>
                {mockOtp && (
                  <View style={styles.mockBox} testID="mock-otp-hint">
                    <Ionicons name="information-circle" size={18} color={theme.colors.brand} />
                    <Text style={styles.mockText}>Demo OTP: {mockOtp}</Text>
                  </View>
                )}
                <TextInput
                  value={otp}
                  onChangeText={setOtp}
                  keyboardType="number-pad"
                  maxLength={6}
                  placeholder="6-digit OTP"
                  placeholderTextColor={theme.colors.onMuted}
                  style={[styles.input, { fontSize: 22, letterSpacing: 6, textAlign: "center" }]}
                  testID="otp-input"
                />
                {err ? <Text style={styles.err}>{err}</Text> : null}
                <PrimaryButton loading={loading} title="Verify & Continue" onPress={verifyOtp} testID="verify-otp-btn" />
              </>
            )}

            {mode === "admin" && (
              <>
                <BackBtn onPress={() => setMode("role")} />
                <Text style={styles.title}>Admin Login</Text>
                <Text style={styles.subtitle}>Sign in with your credentials</Text>
                <TextInput
                  value={email}
                  onChangeText={setEmail}
                  keyboardType="email-address"
                  autoCapitalize="none"
                  placeholder="Email"
                  placeholderTextColor={theme.colors.onMuted}
                  style={styles.input}
                  testID="admin-email"
                />
                <TextInput
                  value={password}
                  onChangeText={setPassword}
                  secureTextEntry
                  placeholder="Password"
                  placeholderTextColor={theme.colors.onMuted}
                  style={styles.input}
                  testID="admin-password"
                />
                {err ? <Text style={styles.err}>{err}</Text> : null}
                <PrimaryButton loading={loading} title="Sign In" onPress={adminLogin} testID="admin-login-btn" />
              </>
            )}
          </View>
        </ScrollView>
      </KeyboardAvoidingView>
    </View>
  );
}

function RoleButton({ icon, title, desc, onPress, testID }: any) {
  return (
    <Pressable onPress={onPress} style={({ pressed }) => [styles.roleBtn, pressed && { opacity: 0.8 }]} testID={testID}>
      <View style={styles.roleIcon}>
        <Ionicons name={icon} size={26} color={theme.colors.brand} />
      </View>
      <View style={{ flex: 1 }}>
        <Text style={styles.roleTitle}>{title}</Text>
        <Text style={styles.roleDesc}>{desc}</Text>
      </View>
      <Ionicons name="chevron-forward" size={22} color={theme.colors.onMuted} />
    </Pressable>
  );
}

function PrimaryButton({ title, onPress, loading, testID }: any) {
  return (
    <Pressable onPress={onPress} disabled={loading} style={({ pressed }) => [styles.primary, pressed && { opacity: 0.85 }]} testID={testID}>
      {loading ? <ActivityIndicator color="#fff" /> : <Text style={styles.primaryText}>{title}</Text>}
    </Pressable>
  );
}

function BackBtn({ onPress }: any) {
  return (
    <Pressable onPress={onPress} style={styles.backBtn} testID="back-btn">
      <Ionicons name="arrow-back" size={22} color={theme.colors.on} />
    </Pressable>
  );
}

const styles = StyleSheet.create({
  hero: { alignItems: "center", paddingHorizontal: 24, marginBottom: 24 },
  logo: {
    width: 84, height: 84, borderRadius: 24, backgroundColor: "#fff",
    alignItems: "center", justifyContent: "center", marginBottom: 16, ...theme.shadow.strong,
  },
  brand: { color: "#fff", fontSize: 32, fontWeight: "800", letterSpacing: 0.5 },
  tagline: { color: "rgba(255,255,255,0.9)", fontSize: 16, marginTop: 6 },
  card: {
    marginHorizontal: 16, backgroundColor: theme.colors.surface2,
    borderRadius: 24, padding: 24, ...theme.shadow.strong,
  },
  title: { fontSize: 24, fontWeight: "800", color: theme.colors.on, marginBottom: 4 },
  subtitle: { fontSize: 15, color: theme.colors.onMuted, marginBottom: 20 },
  roleBtn: {
    flexDirection: "row", alignItems: "center", backgroundColor: theme.colors.surface3,
    borderRadius: 16, padding: 16, marginBottom: 12,
  },
  roleIcon: {
    width: 48, height: 48, borderRadius: 14, backgroundColor: theme.colors.brandLight,
    alignItems: "center", justifyContent: "center", marginRight: 14,
  },
  roleTitle: { fontSize: 16, fontWeight: "700", color: theme.colors.on },
  roleDesc: { fontSize: 13, color: theme.colors.onMuted, marginTop: 2 },
  input: {
    borderWidth: 1.5, borderColor: theme.colors.border, borderRadius: 12,
    paddingHorizontal: 16, paddingVertical: 14, fontSize: 16, color: theme.colors.on,
    marginTop: 12, backgroundColor: theme.colors.surface2,
  },
  phoneRow: { flexDirection: "row", alignItems: "center", gap: 8, marginTop: 12 },
  phonePrefix: {
    fontSize: 16, fontWeight: "700", color: theme.colors.on,
    paddingVertical: 14, paddingHorizontal: 14, backgroundColor: theme.colors.surface3, borderRadius: 12,
  },
  primary: {
    backgroundColor: theme.colors.brand, borderRadius: 16, paddingVertical: 16,
    alignItems: "center", justifyContent: "center", marginTop: 20, ...theme.shadow.card,
  },
  primaryText: { color: "#fff", fontSize: 17, fontWeight: "700" },
  err: { color: theme.colors.error, marginTop: 10, fontSize: 14 },
  mockBox: {
    flexDirection: "row", alignItems: "center", gap: 8, marginTop: 4,
    backgroundColor: theme.colors.brandLight, padding: 12, borderRadius: 12,
  },
  mockText: { color: theme.colors.brand, fontWeight: "700", fontSize: 14 },
  backBtn: {
    width: 36, height: 36, borderRadius: 18, backgroundColor: theme.colors.surface3,
    alignItems: "center", justifyContent: "center", marginBottom: 8,
  },
});
