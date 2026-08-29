import { Ionicons } from "@expo/vector-icons";
import { useRouter } from "expo-router";
import { useEffect, useState } from "react";
import { Pressable, StyleSheet, Text, View } from "react-native";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import { auth, User } from "@/src/lib/api";
import { theme } from "@/src/lib/theme";

export default function DeliveryProfile() {
  const router = useRouter();
  const insets = useSafeAreaInsets();
  const [user, setUser] = useState<User | null>(null);
  useEffect(() => { auth.getUser().then(setUser); }, []);
  const logout = async () => { await auth.clear(); router.replace("/auth/login"); };
  return (
    <View style={{ flex: 1, backgroundColor: theme.colors.surface, paddingTop: insets.top + 24 }}>
      <View style={styles.p}>
        <View style={styles.avatar}><Text style={styles.avatarText}>{(user?.name || "P")[0].toUpperCase()}</Text></View>
        <Text style={styles.name}>{user?.name}</Text>
        <Text style={styles.phone}>+91 {user?.phone}</Text>
        <View style={styles.roleBadge}><Text style={styles.roleBadgeText}>DELIVERY PARTNER</Text></View>
      </View>
      <Pressable style={styles.logout} onPress={logout} testID="dp-logout">
        <Ionicons name="log-out-outline" size={22} color={theme.colors.error} />
        <Text style={styles.logoutText}>Log Out</Text>
      </Pressable>
    </View>
  );
}
const styles = StyleSheet.create({
  p: { alignItems: "center", padding: 24 },
  avatar: { width: 88, height: 88, borderRadius: 44, backgroundColor: theme.colors.brand, alignItems: "center", justifyContent: "center" },
  avatarText: { color: "#fff", fontSize: 36, fontWeight: "800" },
  name: { fontSize: 22, fontWeight: "800", color: theme.colors.on, marginTop: 12 },
  phone: { fontSize: 14, color: theme.colors.onMuted, marginTop: 4 },
  roleBadge: { backgroundColor: theme.colors.brandLight, paddingHorizontal: 12, paddingVertical: 6, borderRadius: 999, marginTop: 10 },
  roleBadgeText: { color: theme.colors.brand, fontSize: 11, fontWeight: "800" },
  logout: { flexDirection: "row", alignItems: "center", justifyContent: "center", gap: 8, margin: 16, padding: 14, borderRadius: 12, backgroundColor: "#FFEBEE" },
  logoutText: { color: theme.colors.error, fontSize: 16, fontWeight: "800" },
});
