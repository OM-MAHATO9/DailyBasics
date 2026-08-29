import { useRouter } from "expo-router";
import { useEffect } from "react";
import { ActivityIndicator, View } from "react-native";
import { auth } from "@/src/lib/api";
import { theme } from "@/src/lib/theme";

export default function Index() {
  const router = useRouter();
  useEffect(() => {
    (async () => {
      const u = await auth.getUser();
      if (!u) router.replace("/auth/login");
      else if (u.role === "customer") router.replace("/(customer)/home");
      else if (u.role === "delivery_partner") router.replace("/(delivery)/dashboard");
      else router.replace("/(admin)/dashboard");
    })();
  }, []);

  return (
    <View style={{ flex: 1, backgroundColor: theme.colors.surface, justifyContent: "center", alignItems: "center" }}>
      <ActivityIndicator size="large" color={theme.colors.brand} />
    </View>
  );
}
