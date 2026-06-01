"use client";

import type { WorldTheme } from "@/lib/world-theme";
import { rgbToHex } from "@/lib/world-theme/color-utils";

type WorldThemeDebugProps = {
  theme: WorldTheme;
};

export function WorldThemeDebug({ theme }: WorldThemeDebugProps) {
  const swatches = [
    { label: "primary", color: rgbToHex(theme.primary) },
    { label: "secondary", color: rgbToHex(theme.secondary) },
    { label: "accent", color: rgbToHex(theme.accent) },
    { label: "background", color: rgbToHex(theme.background) },
  ] as const;

  return (
    <div
      className="pointer-events-none fixed bottom-3 left-3 z-20 flex items-center gap-1 rounded-lg border border-border/60 bg-background/90 px-2 py-1.5 shadow-lg backdrop-blur-sm"
      aria-hidden
    >
      <span className="mr-1 text-[8px] uppercase tracking-wider text-muted">
        world · {theme.source}
      </span>
      {swatches.map((swatch) => (
        <span
          key={swatch.label}
          title={swatch.label}
          className="h-4 w-4 rounded-sm ring-1 ring-white/10"
          style={{ backgroundColor: swatch.color }}
        />
      ))}
    </div>
  );
}
