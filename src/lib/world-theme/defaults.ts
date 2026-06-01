import { hexToRgb, rgbToHex } from "./color-utils";
import type { WorldTheme, WorldThemeCssVars } from "./types";

export const DEFAULT_WORLD_THEME: WorldTheme = {
  primary: hexToRgb("#3d3528"),
  secondary: hexToRgb("#5c4f38"),
  accent: hexToRgb("#c9a962"),
  background: hexToRgb("#08080a"),
  muted: hexToRgb("#9b9690"),
  glow: "rgba(201, 169, 98, 0.22)",
  source: "default",
};

export function themeToCssVars(theme: WorldTheme): WorldThemeCssVars {
  return {
    "--world-primary": rgbToHex(theme.primary),
    "--world-secondary": rgbToHex(theme.secondary),
    "--world-accent": rgbToHex(theme.accent),
    "--world-background": rgbToHex(theme.background),
    "--world-muted": rgbToHex(theme.muted),
    "--world-glow": theme.glow,
  };
}

export const DEFAULT_WORLD_CSS_VARS = themeToCssVars(DEFAULT_WORLD_THEME);
