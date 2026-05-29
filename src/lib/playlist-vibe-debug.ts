import type { TasteProfile } from "./tasteProfile";
import type { VibeProfile } from "./vibeProfile";

export function isPlaylistVibeDebugEnabled(): boolean {
  return (
    process.env.PLAYLIST_VIBE_DEBUG === "1" ||
    process.env.NEXT_PUBLIC_PLAYLIST_VIBE_DEBUG === "1"
  );
}

export type CandidateProfileDebug = {
  taste?: Partial<TasteProfile>;
  vibe?: Partial<VibeProfile>;
  tasteCloseness?: number;
  vibeCloseness?: number;
};

export function toDebugProfile<T extends Record<string, number>>(
  profile: T | null | undefined,
): Partial<T> | undefined {
  if (!profile || !isPlaylistVibeDebugEnabled()) return undefined;
  return profile;
}

export function attachCandidateDebug<T extends object>(
  track: T,
  debug: CandidateProfileDebug,
): T & { debug?: CandidateProfileDebug } {
  const debugEnabled =
    process.env.PLAYLIST_VIBE_DEBUG === "1" ||
    process.env.NEXT_PUBLIC_PLAYLIST_VIBE_DEBUG === "1" ||
    process.env.NEXT_PUBLIC_DEBUG_RECS === "1";
  if (!debugEnabled) return track;
  if (
    !debug.taste &&
    !debug.vibe &&
    debug.tasteCloseness === undefined &&
    debug.vibeCloseness === undefined
  ) {
    return track;
  }
  return {
    ...track,
    debug: {
      tasteCloseness: debug.tasteCloseness,
      vibeCloseness: debug.vibeCloseness,
      taste: debug.taste,
      vibe: debug.vibe,
    },
  };
}
