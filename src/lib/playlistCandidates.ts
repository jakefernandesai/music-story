export {
  generateMiniPlaylist,
  generatePlaylistCandidates,
} from "./mini-playlist";

/** @deprecated Use generateMiniPlaylist — kept for QA scripts. */
export async function debugBeyondPath(
  story: Parameters<typeof import("./mini-playlist").generateMiniPlaylist>[0],
) {
  const { generateMiniPlaylist } = await import("./mini-playlist");
  const playlist = await generateMiniPlaylist(story);
  return { playlist, debug: null };
}
