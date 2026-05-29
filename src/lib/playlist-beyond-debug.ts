import type { BeyondCandidate } from "./beyond-path";
import type { PlaylistCandidateTrack } from "./types";

export type BeyondPathInput = {
  rootTrackId: string;
  rootTrackTitle: string;
  rootArtists: string[];
  rootAlbumTitle: string;
  peopleNodeNames: string[];
  connectedRecordingCount: number;
};

export type BeyondCandidateDebug = {
  title: string;
  artist: string;
  connectionType: string;
  source: string;
  musicalAdjacencyScore: number;
  reason: string;
  matchMethod: string;
  exactArtistMatch: boolean;
  titleMatchOnly: boolean;
  searchedPerson?: string;
  sceneLabel?: string;
  tasteProfile?: string;
  vibeProfile?: string;
  vibeDirectionHints?: string[];
  tasteCloseness?: number;
  vibeCloseness?: number;
};

export type BeyondDebugLog = {
  rootTrack: { id: string; title: string; uri: string };
  rootArtists: string[];
  input: BeyondPathInput;
  candidatesBeforeFilter: BeyondCandidateDebug[];
  candidatesAfterFilter: BeyondCandidateDebug[];
  finalTracks: Array<
    BeyondCandidateDebug & {
      isSeed?: boolean;
      spotifyUri?: string;
    }
  >;
  fallbackUsed: boolean;
  fallbackSeedId: string | null;
  lastfmEnabled?: boolean;
  lastfmCandidateCount?: number;
};

export function createBeyondDebugLog(
  input: BeyondPathInput,
  rootUri: string,
): BeyondDebugLog {
  return {
    rootTrack: {
      id: input.rootTrackId,
      title: input.rootTrackTitle,
      uri: rootUri,
    },
    rootArtists: input.rootArtists,
    input,
    candidatesBeforeFilter: [],
    candidatesAfterFilter: [],
    finalTracks: [],
    fallbackUsed: false,
    fallbackSeedId: null,
  };
}

export function beyondCandidateSnapshot(candidate: BeyondCandidate): BeyondCandidateDebug {
  return {
    title: candidate.title,
    artist: candidate.artist,
    connectionType: candidate.connectionType,
    source: candidate.source,
    musicalAdjacencyScore: candidate.musicalAdjacencyScore,
    reason: candidate.reason,
    matchMethod: candidate.matchMethod,
    exactArtistMatch: candidate.matchMethod === "exact_artist",
    titleMatchOnly: candidate.matchMethod === "title_only",
    searchedPerson: candidate.searchedPerson,
    sceneLabel: candidate.sceneLabel,
    tasteProfile: candidate.tasteProfile?.label,
    vibeProfile: candidate.vibeProfile?.label,
    vibeDirectionHints: candidate.vibeDirectionHints,
    tasteCloseness: candidate.tasteCloseness,
    vibeCloseness: candidate.vibeCloseness,
  };
}

export function trackSnapshot(track: PlaylistCandidateTrack) {
  return {
    title: track.title,
    artist: track.artist,
    connectionType: "unknown",
    source: track.source,
    musicalAdjacencyScore: 0,
    reason: track.reason,
    matchMethod: "none",
    exactArtistMatch: false,
    titleMatchOnly: false,
    spotifyUri: track.spotifyUri,
    isSeed: track.isSeed,
  };
}

export function logBeyondDebug(debug: BeyondDebugLog): void {
  if (process.env.PLAYLIST_BEYOND_DEBUG !== "1") return;

  console.log("\n========== BEYOND PATH DEBUG ==========");
  console.log("Root track:", debug.rootTrack);
  console.log("Root artists:", debug.rootArtists);
  console.log("Input object:", JSON.stringify(debug.input, null, 2));
  console.log(
    "Candidates BEFORE filter:",
    JSON.stringify(debug.candidatesBeforeFilter, null, 2),
  );
  console.log(
    "Candidates AFTER filter:",
    JSON.stringify(debug.candidatesAfterFilter, null, 2),
  );
  console.log("Fallback used:", debug.fallbackUsed, debug.fallbackSeedId ?? "");
  console.log(
    "Last.fm:",
    debug.lastfmEnabled ? `enabled (${debug.lastfmCandidateCount ?? 0} selected)` : "disabled",
  );
  console.log("Final tracks:", JSON.stringify(debug.finalTracks, null, 2));
  console.log("========================================\n");
}

function formatCandidateLine(candidate: BeyondCandidateDebug): string {
  const matchLabel = candidate.titleMatchOnly
    ? "title-match"
    : candidate.exactArtistMatch
      ? "exact-artist"
      : candidate.matchMethod;
  return `${candidate.title} — ${candidate.artist} [${candidate.connectionType}] score=${candidate.musicalAdjacencyScore} match=${matchLabel}`;
}

export function formatBeyondDebugReport(debug: BeyondDebugLog): string {
  const lines = [
    `Root: ${debug.rootTrack.title} (${debug.rootTrack.id})`,
    `Artists: ${debug.rootArtists.join(", ")}`,
    "",
    `All candidates (${debug.candidatesBeforeFilter.length}):`,
    ...debug.candidatesBeforeFilter.map(
      (candidate) =>
        `  • ${formatCandidateLine(candidate)}\n    source: ${candidate.source}\n    reason: ${candidate.reason}`,
    ),
    "",
    `Selected (${debug.candidatesAfterFilter.length}):`,
    ...debug.candidatesAfterFilter.map(
      (candidate) =>
        `  • ${formatCandidateLine(candidate)}\n    source: ${candidate.source}\n    reason: ${candidate.reason}`,
    ),
    "",
    `Fallback: ${debug.fallbackUsed ? debug.fallbackSeedId : "no"}`,
    "",
    "Final:",
    ...debug.finalTracks
      .filter((track) => !track.isSeed)
      .map(
        (track) =>
          `  • ${formatCandidateLine(track)}\n    source: ${track.source}\n    reason: ${track.reason}`,
      ),
  ];
  return lines.join("\n");
}
