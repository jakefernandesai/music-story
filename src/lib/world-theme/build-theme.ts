import {
  darkenForBackground,
  ensureReadableAccent,
  hslToRgb,
  mixRgb,
  relativeLuminance,
  rgbToHsl,
} from "./color-utils";
import { DEFAULT_WORLD_THEME } from "./defaults";
import { buildThemeFromSeed } from "./hash-palette";
import type { Rgb, WorldTheme } from "./types";

function pickAccent(samples: Rgb[]): Rgb {
  return samples.reduce((best, sample) => {
    const { s, l } = rgbToHsl(sample);
    if (l < 0.12 || l > 0.92 || s < 0.15) return best;
    const bestScore =
      rgbToHsl(best).s * (1 - Math.abs(rgbToHsl(best).l - 0.52));
    const score = s * (1 - Math.abs(l - 0.52));
    return score > bestScore ? sample : best;
  }, samples[0]!);
}

function pickPrimary(samples: Rgb[]): Rgb {
  const buckets = new Map<number, { weight: number; r: number; g: number; b: number }>();

  for (const sample of samples) {
    const { h, s, l } = rgbToHsl(sample);
    if (l < 0.08 || l > 0.94) continue;
    const bucket = Math.round(h / 24) * 24;
    const weight = s * (1 - Math.abs(l - 0.45));
    const existing = buckets.get(bucket);
    if (existing) {
      existing.weight += weight;
      existing.r += sample.r * weight;
      existing.g += sample.g * weight;
      existing.b += sample.b * weight;
    } else {
      buckets.set(bucket, {
        weight,
        r: sample.r * weight,
        g: sample.g * weight,
        b: sample.b * weight,
      });
    }
  }

  const ranked = [...buckets.entries()].sort((a, b) => b[1].weight - a[1].weight);
  if (ranked.length === 0) return samples[0] ?? DEFAULT_WORLD_THEME.primary;

  const top = ranked[0]![1];
  return {
    r: Math.round(top.r / top.weight),
    g: Math.round(top.g / top.weight),
    b: Math.round(top.b / top.weight),
  };
}

export function buildThemeFromSamples(samples: Rgb[]): WorldTheme {
  if (samples.length === 0) return DEFAULT_WORLD_THEME;

  const primary = pickPrimary(samples);
  const accentRaw = pickAccent(samples);
  const { h: primaryHue } = rgbToHsl(primary);
  const secondary = hslToRgb((primaryHue + 32) % 360, 0.36, 0.46);

  let background = darkenForBackground(primary, 0.07);
  if (relativeLuminance(background) > 0.12) {
    background = darkenForBackground(primary, 0.05);
  }

  const accent = ensureReadableAccent(accentRaw, background);
  const muted = hslToRgb(primaryHue, 0.14, 0.55);
  const glowRgb = mixRgb(accent, primary, 0.3);

  return {
    primary,
    secondary,
    accent,
    background,
    muted,
    glow: `rgba(${glowRgb.r}, ${glowRgb.g}, ${glowRgb.b}, 0.26)`,
    source: "extracted",
  };
}

export function resolveWorldTheme(input: {
  samples: Rgb[] | null;
  seed: string;
}): WorldTheme {
  if (input.samples && input.samples.length > 0) {
    return buildThemeFromSamples(input.samples);
  }
  if (input.seed) {
    return buildThemeFromSeed(input.seed);
  }
  return DEFAULT_WORLD_THEME;
}
