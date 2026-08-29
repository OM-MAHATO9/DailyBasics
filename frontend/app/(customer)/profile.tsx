import { Ionicons } from "@expo/vector-icons";
import { useRouter } from "expo-router";
import { useEffect, useState } from "react";
import { Pressable, ScrollView, StyleSheet, Text, View } from "react-native";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import { auth, User } from "@/src/lib/api";
import { theme } from "@/src/lib/theme";

export default function Profile() {
  const router = useRouter();
  const insets = useSafeAreaInsets();
  const [user, setUser] = useState<User | null>(null);

  useEffect(() => { auth.getUser().then(setUser); }, []);

  const logout = async () => {
    await auth.clear();
    router.replace("/auth/login");
  };

  const items = [
    { icon: "location", label: "Saved Addresses", onPress: () => {} },
    { icon: "heart", label: "Favourites", onPress: () => {} },
    { icon: "gift", label: "Coupons & Offers", onPress: () => {} },
    { icon: "notifications", label: "Notifications", onPress: () => {} },
    { icon: "help-circle", label: "Help & Support", onPress: () => {} },
    { icon: "call", label: "Contact Us", onPress: () => {} },
    { icon: "document-text", label: "Terms & Privacy", onPress: () => {} },
  ];

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
        <View style={styles.list}>
          {items.map((i, idx) => (
            <Pressable key={idx} style={styles.row} onPress={i.onPress} testID={`profile-${i.label}`}>
              <Ionicons name={i.icon as any} size={22} color={theme.colors.brand} />
              <Text style={styles.rowText}>{i.label}</Text>
              <Ionicons name="chevron-forward" size={20} color={theme.colors.onMuted} />
            </Pressable>
          ))}
        </View>
        <Pressable style={styles.logout} onPress={logout} testID="logout-btn">
          <Ionicons name="log-out-outline" size={22} color={theme.colors.error} />
          <Text style={styles.logoutText}>Log Out</Text>
        </Pressable>
      </ScrollView>
    </View>
  );
}

const styles = StyleSheet.create({
  profile: { alignItems: "center", paddingVertical: 24 },
  avatar: { width: 88, height: 88, borderRadius: 44, backgroundColor: theme.colors.brand, alignItems: "center", justifyContent: "center", ...theme.shadow.card },
  avatarText: { color: "#fff", fontSize: 36, fontWeight: "800" },
  name: { fontSize: 22, fontWeight: "800", color: theme.colors.on, marginTop: 12 },
  phone: { fontSize: 14, color: theme.colors.onMuted, marginTop: 4 },
  list: { marginHorizontal: 16, backgroundColor: theme.colors.surface2, borderRadius: 16, overflow: "hidden", borderWidth: 1, borderColor: theme.colors.border },
  row: { flexDirection: "row", alignItems: "center", padding: 16, gap: 14, borderBottomWidth: 1, borderBottomColor: theme.colors.divider },
  rowText: { flex: 1, fontSize: 16, fontWeight: "600", color: theme.colors.on },
  logout: { flexDirection: "row", alignItems: "center", justifyContent: "center", gap: 8, marginTop: 20, padding: 14, marginHorizontal: 16, borderRadius: 12, backgroundColor: "#FFEBEE" },
  logoutText: { color: theme.colors.error, fontSize: 16, fontWeight: "800" },
});
