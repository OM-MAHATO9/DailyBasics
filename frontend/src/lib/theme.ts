export const theme = {
  colors: {
    surface: "#FAFAFA",
    surface2: "#FFFFFF",
    surface3: "#F0F0F0",
    on: "#1E1E1E",
    onMuted: "#616161",
    brand: "#E65100",
    brandOn: "#FFFFFF",
    brand2: "#FF9800",
    brandLight: "#FFF3E0",
    success: "#2E7D32",
    warning: "#F57C00",
    error: "#D32F2F",
    border: "#E0E0E0",
    borderStrong: "#BDBDBD",
    divider: "#EEEEEE",
  },
  space: { xs: 4, sm: 8, md: 12, lg: 16, xl: 24, xxl: 32 },
  radius: { sm: 8, md: 16, lg: 24, pill: 999 },
  font: {
    sm: 14,
    base: 16,
    lg: 18,
    xl: 24,
    xxl: 28,
  },
  shadow: {
    card: {
      shadowColor: "#000",
      shadowOffset: { width: 0, height: 2 },
      shadowOpacity: 0.08,
      shadowRadius: 8,
      elevation: 3,
    },
    strong: {
      shadowColor: "#000",
      shadowOffset: { width: 0, height: 4 },
      shadowOpacity: 0.12,
      shadowRadius: 12,
      elevation: 6,
    },
  },
};

export const formatINR = (n: number) => `₹${Math.round(n)}`;
