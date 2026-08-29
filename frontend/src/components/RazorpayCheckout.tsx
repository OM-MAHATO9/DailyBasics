import { WebView, WebViewMessageEvent } from "react-native-webview";
import { Modal, Platform, Pressable, StyleSheet, Text, View } from "react-native";
import { Ionicons } from "@expo/vector-icons";
import { theme } from "@/src/lib/theme";

type Props = {
  visible: boolean;
  order: {
    id: string;
    order_number: string;
    razorpay_order_id: string;
    razorpay_amount_paise: number;
    razorpay_key_id: string;
  };
  user: { name?: string; email?: string; phone?: string };
  onSuccess: (r: { razorpay_order_id: string; razorpay_payment_id: string; razorpay_signature: string }) => void;
  onFailure: (r: any) => void;
  onDismiss: () => void;
};

export default function RazorpayCheckout({ visible, order, user, onSuccess, onFailure, onDismiss }: Props) {
  const html = `<!doctype html><html><head><meta name="viewport" content="width=device-width, initial-scale=1"><style>body{margin:0;background:#fff;font-family:sans-serif;padding-top:80px;text-align:center;color:#616161}</style></head>
<body>
<p>Opening Razorpay Checkout...</p>
<script src="https://checkout.razorpay.com/v1/checkout.js"></script>
<script>
  const options = {
    key: ${JSON.stringify(order.razorpay_key_id)},
    amount: ${JSON.stringify(String(order.razorpay_amount_paise))},
    currency: "INR",
    name: "DailyBasics",
    description: "Order " + ${JSON.stringify(order.order_number)},
    order_id: ${JSON.stringify(order.razorpay_order_id)},
    prefill: {
      name: ${JSON.stringify(user.name || "")},
      email: ${JSON.stringify(user.email || "")},
      contact: ${JSON.stringify(user.phone || "")}
    },
    theme: { color: "#E65100" },
    modal: {
      ondismiss: function() {
        window.ReactNativeWebView.postMessage(JSON.stringify({ type: "dismiss" }));
      }
    },
    handler: function (response) {
      window.ReactNativeWebView.postMessage(JSON.stringify({ type: "success", data: response }));
    }
  };
  const checkout = new Razorpay(options);
  checkout.on("payment.failed", function (response) {
    window.ReactNativeWebView.postMessage(JSON.stringify({ type: "failure", data: response.error || response }));
  });
  checkout.open();
</script>
</body></html>`;

  const onMessage = (event: WebViewMessageEvent) => {
    try {
      const msg = JSON.parse(event.nativeEvent.data);
      if (msg.type === "success") onSuccess(msg.data);
      else if (msg.type === "failure") onFailure(msg.data);
      else if (msg.type === "dismiss") onDismiss();
    } catch {
      onFailure({ description: "Invalid response" });
    }
  };

  return (
    <Modal visible={visible} animationType="slide" onRequestClose={onDismiss} testID="rzp-modal">
      <View style={{ flex: 1, backgroundColor: "#fff" }}>
        <View style={[styles.head, { paddingTop: Platform.OS === "ios" ? 50 : 20 }]}>
          <Pressable onPress={onDismiss} testID="rzp-close"><Ionicons name="close" size={26} color={theme.colors.on} /></Pressable>
          <Text style={styles.headTitle}>Razorpay Checkout</Text>
          <View style={{ width: 26 }} />
        </View>
        <WebView
          originWhitelist={["*"]}
          source={{ html }}
          onMessage={onMessage}
          javaScriptEnabled
          domStorageEnabled
          style={{ flex: 1 }}
        />
      </View>
    </Modal>
  );
}

const styles = StyleSheet.create({
  head: { flexDirection: "row", alignItems: "center", justifyContent: "space-between", paddingHorizontal: 16, paddingBottom: 12, borderBottomWidth: 1, borderBottomColor: theme.colors.divider },
  headTitle: { fontSize: 16, fontWeight: "800", color: theme.colors.on },
});
