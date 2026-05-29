import type { VibeDirectionChip } from "./types";
import { VIBE_DIRECTION_LABELS } from "./vibeProfile";

/** Short consumer-facing direction labels for track rows. */
export const SHORT_DIRECTION_LABELS: Record<VibeDirectionChip, string> = {
  more_euphoric: "more euphoric",
  more_destructive: "heavier",
  more_nostalgic: "dreamier",
  more_futuristic: "more futuristic",
  more_intimate: "more intimate",
  more_melancholic: "more melancholic",
};

export function pickDirectionLabel(
  hints?: VibeDirectionChip[],
): string | undefined {
  if (!hints || hints.length === 0) return undefined;
  return SHORT_DIRECTION_LABELS[hints[0]!] ?? VIBE_DIRECTION_LABELS[hints[0]!];
}

export function pickPathDirections(
  available?: VibeDirectionChip[],
  limit = 3,
): string[] {
  if (!available || available.length === 0) return [];
  return available.slice(0, limit).map(
    (chip) => SHORT_DIRECTION_LABELS[chip] ?? VIBE_DIRECTION_LABELS[chip],
  );
}

export function tasteClosenessToPathRoute(closeness: number): import("./types").PathRoute {
  if (closeness >= 0.72) return "familiar";
  if (closeness >= 0.45) return "adjacent";
  return "stranger";
}
