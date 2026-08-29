import { Ionicons } from "@expo/vector-icons";
import * as Clipboard from "expo-clipboard";
import { useRouter, useFocusEffect } from "expo-router";
import { useCallback, useState } from "react";
import { Pressable, ScrollView, Share, StyleSheet, Text, View } from "react-native";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import { api, auth, User } from "@/src/lib/api";
import { theme, formatINR } from "@/src/lib/theme";

export default function Profile() {
  const router = useRouter();
  const insets = useSafeAreaInsets();
  const [user, setUser] = useState<User | null>(null);
  const [wallet, setWallet] = useState<{ balance: number; referral_code: string; transactions: any[] } | null>(null);
  const [ref, setRef] = useState<any>(null);
  const [copied, setCopied] = useState(false);

  useFocusEffect(useCallback(() => {
    auth.getUser().then(setUser);
    api.wallet().then(setWallet).catch(() => {});
    api.referral().then(setRef).catch(() => {});
  }, []));

  const copyCode = async () => {
    if (!ref?.referral_code) return;
    await Clipboard.setStringAsync(ref.referral_code);
    setCopied(true);
    setTimeout(() => setCopied(false), 1500);
  };

  const shareCode = async () => {
    if (!ref) return;
    try { await Share.share({ message: ref.share_message }); } catch {}
  };

  const logout = async () => {
    await auth.clear();
    router.replace("/auth/login");
  };

  return (
    <View style={{ flex: 1, backgroundColor: theme.colors.surface }}>
      <ScrollView contentContainerStyle={{ paddingTop: insets.top + 16, paddingBottom: 24 + insets.bottom }}>
        <View style={styles.profile}>
          <View style={styles.avatar}>
            <Text style={styles.avatarText}>{(user?.name || user?.phone || "U")[0].toUpperCase()}</Text>
          </View>
          <Text style={styles.name}>{user?.name || "User"}</Text>
          <Text style={styles.phone}>+91 {user?.phone}</Text>
        </View>

        {/* Wallet card */}
        <View style={styles.walletCard} testID="wallet-card">
          <View style={{ flex: 1 }}>
            <Text style={styles.walletLabel}>DailyBasics Wallet</Text>
            <Text style={styles.walletBalance}>{formatINR(wallet?.balance ?? 0)}</Text>
            <Text style={styles.walletHint}>Auto-applied at checkout</Text>
          </View>
          <Ionicons name="wallet" size={44} color={theme.colors.brand} />
        </View>

        {/* Referral card */}
        {ref?.referral_code && (
          <View style={styles.refCard} testID="referral-card">
            <View style={styles.refHead}>
              <Ionicons name="gift" size={22} color={theme.colors.brand} />
              <Text style={styles.refTitle}>Refer & Earn ₹{Math.round(ref.reward_amount)}</Text>
            </View>
            <Text style={styles.refSub}>Both you and your friend get ₹{Math.round(ref.reward_amount)} in wallet when they place their first order of ₹{Math.round(ref.min_order)}+.</Text>
            <View style={styles.refCodeBox}>
              <View style={{ flex: 1 }}>
                <Text style={styles.refCodeLabel}>Your code</Text>
                <Text style={styles.refCode} testID="my-referral-code">{ref.referral_code}</Text>
              </View>
              <Pressable onPress={copyCode} style={styles.refBtn} testID="copy-referral">
                <Ionicons name={copied ? "checkmark" : "copy"} size={18} color="#fff" />
                <Text style={styles.refBtnText}>{copied ? "Copied" : "Copy"}</Text>
              </Pressable>
              <Pressable onPress={shareCode} style={[styles.refBtn, { backgroundColor: theme.colors.success }]} testID="share-referral">
                <Ionicons name="share-social" size={18} color="#fff" />
                <Text style={styles.refBtnText}>Share</Text>
              </Pressable>
            </View>
            {ref.referred_count > 0 && (
              <Text style={styles.refBadge}>🎉 {ref.referred_count} friend{ref.referred_count > 1 ? "s" : ""} joined via your code</Text>
            )}
          </View>
        )}

        {/* Wallet transactions */}
        {wallet && wallet.transactions.length > 0 && (
          <View style={styles.txnBox}>
            <Text style={styles.txnHead}>Recent Wallet Activity</Text>
            {wallet.transactions.slice(0, 5).map((t, i) => (
              <View key={i} style={styles.txnRow}>
                <View style={{ flex: 1 }}>
                  <Text style={styles.txnNote}>{t.note}</Text>
                  <Text style={styles.txnDate}>{new Date(t.created_at).toLocaleDateString()}</Text>
                </View>
                <Text style={[styles.txnAmt, { color: t.amount >= 0 ? theme.colors.success : theme.colors.error }]}>
                  {t.amount >= 0 ? "+" : ""}{formatINR(t.amount)}
                </Text>
              </View>
            ))}
          </View>
        )}

        <View style={styles.list}>
          <Row icon="location" label="Saved Addresses" />
          <Row icon="heart" label="Favourites" />
          <Row icon="notifications" label="Notifications" />
          <Row icon="help-circle" label="Help & Support" />
          <Row icon="call" label="Contact Us" />
          <Row icon="document-text" label="Terms & Privacy" />
        </View>
        <Pressable style={styles.logout} onPress={logout} testID="logout-btn">
          <Ionicons name="log-out-outline" size={22} color={theme.colors.error} />
          <Text style={styles.logoutText}>Log Out</Text>
        </Pressable>
      </ScrollView>
    </View>
  );
}

function Row({ icon, label }: any) {
  return (
    <Pressable style={styles.row} testID={`profile-${label}`}>
      <Ionicons name={icon} size={22} color={theme.colors.brand} />
      <Text style={styles.rowText}>{label}</Text>
      <Ionicons name="chevron-forward" size={20} color={theme.colors.onMuted} />
    </Pressable>
  );
}

const styles = StyleSheet.create({
  profile: { alignItems: "center", paddingVertical: 24 },
  avatar: { width: 88, height: 88, borderRadius: 44, backgroundColor: theme.colors.brand, alignItems: "center", justifyContent: "center", ...theme.shadow.card },
  avatarText: { color: "#fff", fontSize: 36, fontWeight: "800" },
  name: { fontSize: 22, fontWeight: "800", color: theme.colors.on, marginTop: 12 },
  phone: { fontSize: 14, color: theme.colors.onMuted, marginTop: 4 },
  walletCard: { flexDirection: "row", alignItems: "center", marginHorizontal: 16, padding: 16, backgroundColor: theme.colors.brandLight, borderRadius: 16, marginBottom: 12 },
  walletLabel: { fontSize: 13, color: theme.colors.onMuted },
  walletBalance: { fontSize: 28, fontWeight: "800", color: theme.colors.brand, marginTop: 2 },
  walletHint: { fontSize: 12, color: theme.colors.onMuted, marginTop: 2 },
  refCard: { marginHorizontal: 16, padding: 16, backgroundColor: theme.colors.surface2, borderRadius: 16, borderWidth: 1.5, borderColor: theme.colors.brand, marginBottom: 12, ...theme.shadow.card },
  refHead: { flexDirection: "row", alignItems: "center", gap: 8 },
  refTitle: { fontSize: 17, fontWeight: "800", color: theme.colors.on },
  refSub: { fontSize: 13, color: theme.colors.onMuted, marginTop: 6, lineHeight: 18 },
  refCodeBox: { flexDirection: "row", alignItems: "center", gap: 8, marginTop: 12, backgroundColor: theme.colors.brandLight, padding: 12, borderRadius: 12 },
  refCodeLabel: { fontSize: 10, color: theme.colors.onMuted, fontWeight: "700", letterSpacing: 0.5 },
  refCode: { fontSize: 22, fontWeight: "800", color: theme.colors.brand, letterSpacing: 2 },
  refBtn: { flexDirection: "row", alignItems: "center", gap: 4, backgroundColor: theme.colors.brand, paddingHorizontal: 12, paddingVertical: 8, borderRadius: 10 },
  refBtnText: { color: "#fff", fontWeight: "800", fontSize: 12 },
  refBadge: { marginTop: 10, fontSize: 13, color: theme.colors.success, fontWeight: "700" },
  txnBox: { marginHorizontal: 16, padding: 14, backgroundColor: theme.colors.surface2, borderRadius: 12, marginBottom: 12, borderWidth: 1, borderColor: theme.colors.border },
  txnHead: { fontSize: 14, fontWeight: "800", color: theme.colors.on, marginBottom: 8 },
  txnRow: { flexDirection: "row", alignItems: "center", paddingVertical: 6, borderTopWidth: 1, borderTopColor: theme.colors.divider },
  txnNote: { fontSize: 13, color: theme.colors.on },
  txnDate: { fontSize: 11, color: theme.colors.onMuted, marginTop: 2 },
  txnAmt: { fontSize: 14, fontWeight: "800" },
  list: { marginHorizontal: 16, backgroundColor: theme.colors.surface2, borderRadius: 16, overflow: "hidden", borderWidth: 1, borderColor: theme.colors.border },
  row: { flexDirection: "row", alignItems: "center", padding: 16, gap: 14, borderBottomWidth: 1, borderBottomColor: theme.colors.divider },
  rowText: { flex: 1, fontSize: 16, fontWeight: "600", color: theme.colors.on },
  logout: { flexDirection: "row", alignItems: "center", justifyContent: "center", gap: 8, marginTop: 20, padding: 14, marginHorizontal: 16, borderRadius: 12, backgroundColor: "#FFEBEE" },
  logoutText: { color: theme.colors.error, fontSize: 16, fontWeight: "800" },
});
