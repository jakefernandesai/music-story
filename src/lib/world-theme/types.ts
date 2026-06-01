export type Rgb = {
  r: number;
  g: number;
  b: number;
};

export type WorldPalette = {
  primary: Rgb;
  secondary: Rgb;
  accent: Rgb;
  background: Rgb;
  muted: Rgb;
};

export type WorldTheme = WorldPalette & {
  glow: string;
  source: "extracted" | "hash" | "default";
};

export type WorldThemeCssVars = {
  "--world-primary": string;
  "--world-secondary": string;
  "--world-accent": string;
  "--world-background": string;
  "--world-muted": string;
  "--world-glow": string;
};
