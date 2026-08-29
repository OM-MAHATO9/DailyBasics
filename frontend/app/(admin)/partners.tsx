import { Ionicons } from "@expo/vector-icons";
import { useFocusEffect } from "expo-router";
import { useCallback, useState } from "react";
import { FlatList, KeyboardAvoidingView, Platform, Pressable, StyleSheet, Switch, Text, TextInput, View } from "react-native";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import { api } from "@/src/lib/api";
import { theme } from "@/src/lib/theme";

export default function AdminPartners() {
  const insets = useSafeAreaInsets();
  const [partners, setPartners] = useState<any[]>([]);
  const [showAdd, setShowAdd] = useState(false);
  const [phone, setPhone] = useState("");
  const [name, setName] = useState("");
  const [err, setErr] = useState("");

  const load = useCallback(() => { api.adminPartners().then(setPartners).catch(() => {}); }, []);
  useFocusEffect(useCallback(() => { load(); }, [load]));

  const toggle = async (id: string, active: boolean) => {
    await api.togglePartner(id, active);
    load();
  };
  const add = async () => {
    setErr("");
    if (phone.length < 10 || !name) { setErr("Enter phone and name"); return; }
    try { await api.addPartner(phone, name); setPhone(""); setName(""); setShowAdd(false); load(); }
    catch (e: any) { setErr(e.message); }
  };

  return (
    <View style={{ flex: 1, backgroundColor: theme.colors.surface }}>
      <View style={[styles.header, { paddingTop: insets.top + 12 }]}>
        <Text style={styles.title}>Delivery Partners</Text>
        <Pressable style={styles.addBtn} onPress={() => setShowAdd((v) => !v)} testID="toggle-add-partner">
          <Ionicons name={showAdd ? "close" : "add"} size={22} color="#fff" />
        </Pressable>
      </View>
      <KeyboardAvoidingView style={{ flex: 1 }} behavior={Platform.OS === "ios" ? "padding" : undefined}>
        {showAdd && (
          <View style={styles.form}>
            <TextInput value={name} onChangeText={setName} placeholder="Partner Name" placeholderTextColor={theme.colors.onMuted} style={styles.input} testID="partner-name" />
            <TextInput value={phone} onChangeText={setPhone} placeholder="10-digit Phone" placeholderTextColor={theme.colors.onMuted} keyboardType="number-pad" maxLength={10} style={styles.input} testID="partner-phone" />
            {err ? <Text style={styles.err}>{err}</Text> : null}
            <Pressable style={styles.saveBtn} onPress={add} testID="add-partner-btn">
              <Text style={styles.saveText}>Add Partner</Text>
            </Pressable>
          </View>
        )}
        <FlatList
          data={partners}
          keyExtractor={(p) => p.id}
          contentContainerStyle={{ padding: 16, gap: 8, paddingBottom: 100 + insets.bottom }}
          renderItem={({ item }) => (
            <View style={styles.card}>
              <View style={styles.avatar}><Text style={styles.avText}>{(item.name || "P")[0].toUpperCase()}</Text></View>
              <View style={{ flex: 1, marginLeft: 10 }}>
                <Text style={styles.name}>{item.name}</Text>
                <Text style={styles.phone}>+91 {item.phone}</Text>
              </View>
              <Switch value={item.is_active} onValueChange={(v) => toggle(item.id, v)} thumbColor={item.is_active ? theme.colors.success : "#fff"} />
            </View>
          )}
        />
      </KeyboardAvoidingView>
    </View>
  );
}

const styles = StyleSheet.create({
  header: { flexDirection: "row", alignItems: "flex-end", justifyContent: "space-between", paddingHorizontal: 16, paddingBottom: 12, backgroundColor: theme.colors.surface2, borderBottomWidth: 1, borderBottomColor: theme.colors.divider },
  title: { fontSize: 22, fontWeight: "800", color: theme.colors.on },
  addBtn: { width: 40, height: 40, borderRadius: 20, backgroundColor: theme.colors.brand, alignItems: "center", justifyContent: "center" },
  form: { padding: 16, backgroundColor: theme.colors.surface2, borderBottomWidth: 1, borderBottomColor: theme.colors.divider },
  input: { borderWidth: 1, borderColor: theme.colors.border, borderRadius: 10, paddingHorizontal: 12, paddingVertical: 12, fontSize: 15, marginBottom: 10, color: theme.colors.on },
  err: { color: theme.colors.error, marginBottom: 8 },
  saveBtn: { backgroundColor: theme.colors.brand, padding: 12, borderRadius: 10, alignItems: "center" },
  saveText: { color: "#fff", fontWeight: "800" },
  card: { flexDirection: "row", alignItems: "center", padding: 12, backgroundColor: theme.colors.surface2, borderRadius: 12, borderWidth: 1, borderColor: theme.colors.border },
  avatar: { width: 48, height: 48, borderRadius: 24, backgroundColor: theme.colors.brand, alignItems: "center", justifyContent: "center" },
  avText: { color: "#fff", fontSize: 20, fontWeight: "800" },
  name: { fontSize: 15, fontWeight: "700", color: theme.colors.on },
  phone: { fontSize: 13, color: theme.colors.onMuted, marginTop: 2 },
});
