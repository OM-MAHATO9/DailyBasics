import { Stack, useRouter, useSegments } from "expo-router";
import * as SplashScreen from "expo-splash-screen";
import { useEffect, useState } from "react";
import { LogBox } from "react-native";
import { SafeAreaProvider } from "react-native-safe-area-context";
import { useIconFonts } from "@/src/hooks/use-icon-fonts";
import { CartProvider } from "@/src/lib/cart";
import { auth } from "@/src/lib/api";

LogBox.ignoreAllLogs(true);
SplashScreen.preventAutoHideAsync();

function useProtectedRoute() {
  const segments = useSegments();
  const router = useRouter();
  const [checked, setChecked] = useState(false);

  useEffect(() => {
    (async () => {
      const user = await auth.getUser();
      const inAuth = segments[0] === "auth";
      const inCustomer = segments[0] === "(customer)";
      const inDelivery = segments[0] === "(delivery)";
      const inAdmin = segments[0] === "(admin)";

      if (!user) {
        if (!inAuth) router.replace("/auth/login");
      } else {
        const shouldBeIn =
          user.role === "customer" ? "(customer)" : user.role === "delivery_partner" ? "(delivery)" : "(admin)";
        const isCorrect = segments[0] === shouldBeIn;
        if (!isCorrect) {
          if (user.role === "customer") router.replace("/(customer)/home");
          else if (user.role === "delivery_partner") router.replace("/(delivery)/dashboard");
          else router.replace("/(admin)/dashboard");
        }
      }
      setChecked(true);
    })();
  }, [segments]);

  return checked;
}

function Root() {
  useProtectedRoute();
  return <Stack screenOptions={{ headerShown: false, animation: "slide_from_right" }} />;
}

export default function RootLayout() {
  const [loaded, error] = useIconFonts();

  useEffect(() => {
    if (loaded || error) SplashScreen.hideAsync();
  }, [loaded, error]);

  if (!loaded && !error) return null;

  return (
    <SafeAreaProvider>
      <CartProvider>
        <Root />
      </CartProvider>
    </SafeAreaProvider>
  );
}
