import { Dimensions, PixelRatio } from "react-native";

const { width: SCREEN_W, height: SCREEN_H } = Dimensions.get("window");

// Base design width (iPhone 14 Pro = 393px)
const BASE_WIDTH = 393;

/** Scale a size relative to screen width */
export const sw = (size: number) =>
  Math.round(PixelRatio.roundToNearestPixel((size * SCREEN_W) / BASE_WIDTH));

/** Clamp a scaled value between min and max */
export const swClamp = (size: number, min: number, max: number) =>
  Math.min(Math.max(sw(size), min), max);

export const SCREEN_WIDTH = SCREEN_W;
export const SCREEN_HEIGHT = SCREEN_H;

/** Whether it's a narrow phone (< 360px) */
export const isSmall = SCREEN_W < 360;
/** Whether it's a tablet (>= 600px) */
export const isTablet = SCREEN_W >= 600;

/** Category sidebar width: 28% of screen, clamped between 80 and 130 */
export const SIDEBAR_W = Math.min(Math.max(Math.round(SCREEN_W * 0.28), 80), 130);

/** Product card width when used in horizontal scroll rows */
export const CARD_H_W = Math.min(Math.round(SCREEN_W * 0.42), 180);

/** Home category card width: 4 per row with gaps */
export const CAT_CARD_W = Math.floor((SCREEN_W - 32 - 12) / 4);
