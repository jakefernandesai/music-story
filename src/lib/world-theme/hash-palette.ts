import {
  darkenForBackground,
  ensureReadableAccent,
  hslToRgb,
  mixRgb,
  rgbToHex,
} from "./color-utils";
import type { WorldTheme } from "./types";

function hashHue(seed: string): number {
  let hash = 0;
  for (let i = 0; i < seed.length; i += 1) {
    hash = (hash * 31 + seed.charCodeAt(i)) >>> 0;
  }
  return hash % 360;
}

export function buildThemeFromSeed(seed: string): WorldTheme {
  const hue = hashHue(seed);
  const primary = hslToRgb(hue, 0.42, 0.38);
  const secondary = hslToRgb((hue + 28) % 360, 0.38, 0.48);
  const accent = hslToRgb((hue + 12) % 360, 0.62, 0.62);
  const background = darkenForBackground(primary, 0.07);
  const muted = hslToRgb(hue, 0.12, 0.58);
  const accentReadable = ensureReadableAccent(accent, background);
  const glowRgb = mixRgb(accentReadable, primary, 0.35);

  return {
    primary,
    secondary,
    accent: accentReadable,
    background,
    muted,
    glow: `rgba(${glowRgb.r}, ${glowRgb.g}, ${glowRgb.b}, 0.24)`,
    source: "hash",
  };
}

export function buildThemeFromSeedForDebug(seed: string): Record<string, string> {
  const theme = buildThemeFromSeed(seed);
  return {
    primary: rgbToHex(theme.primary),
    secondary: rgbToHex(theme.secondary),
    accent: rgbToHex(theme.accent),
    background: rgbToHex(theme.background),
    muted: rgbToHex(theme.muted),
  };
}
