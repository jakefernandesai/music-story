"use client";

import {
  useEffect,
  useMemo,
  useState,
  type CSSProperties,
  type ReactNode,
} from "react";
import { isValidImageUrl } from "@/lib/artwork";
import {
  DEFAULT_WORLD_THEME,
  extractPaletteFromImageUrl,
  resolveWorldTheme,
  themeToCssVars,
  type WorldTheme,
} from "@/lib/world-theme";
import { WorldThemeDebug } from "./WorldThemeDebug";

type WorldThemeProviderProps = {
  artworkUrl: string | null | undefined;
  seed: string;
  showDebug?: boolean;
  children: ReactNode;
};

export function WorldThemeProvider({
  artworkUrl,
  seed,
  showDebug = false,
  children,
}: WorldThemeProviderProps) {
  const [theme, setTheme] = useState<WorldTheme>(DEFAULT_WORLD_THEME);
  const [ready, setReady] = useState(false);

  const style = useMemo(() => {
    const vars = themeToCssVars(theme);
    return {
      ...vars,
      "--background": vars["--world-background"],
      "--accent": vars["--world-accent"],
      "--accent-muted": `color-mix(in srgb, ${vars["--world-accent"]} 15%, transparent)`,
    } as CSSProperties;
  }, [theme]);

  useEffect(() => {
    let cancelled = false;

    async function loadTheme() {
      let samples = null;
      if (isValidImageUrl(artworkUrl)) {
        samples = await extractPaletteFromImageUrl(artworkUrl);
      }

      const resolved = resolveWorldTheme({
        samples,
        seed: artworkUrl ?? seed,
      });

      if (!cancelled) {
        setTheme(resolved);
        setReady(true);
      }
    }

    void loadTheme();

    return () => {
      cancelled = true;
    };
  }, [artworkUrl, seed]);

  return (
    <div
      className={`world-theme relative -mx-5 px-5 sm:mx-0 sm:px-0 ${ready ? "world-theme--ready" : ""}`}
      style={style}
    >
      <div className="world-page-wash pointer-events-none absolute inset-x-0 top-0 h-[min(100vh,900px)]" aria-hidden />
      {showDebug && ready && <WorldThemeDebug theme={theme} />}
      <div className="relative z-[1]">{children}</div>
    </div>
  );
}
