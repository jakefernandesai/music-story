import { formatArtists } from "./format";
import {
  getLastfmArtistTags,
  getLastfmTrackTags,
  isLastfmEnabled,
} from "./lastfm";
import {
  buildCandidatePool,
  dedupeKey,
  fallbackSeedsForHole,
  FAMILY_DEFAULT_SEED_ID,
  HOLE_MIN_BEFORE_FALLBACK,
  isTrackAllowedForHole,
  pickBestFallbackSeed,
  poolForRoute,
  RABBIT_HOLES,
  realCandidateCount,
  resolveCandidateFamily,
  scoreForHole,
  seedToTrack,
  TARGET_MAX,
  TARGET_MIN,
  type PoolTrack,
} from "./mini-playlist";
import { isSpotifyRateLimited } from "./spotify-artist-search";
import type {
  SimilarArtistSpotifyDiagnostic,
  UnresolvedSimilarArtist,
} from "./spotify-artist-search";
import { enrichRootTags } from "./tag-enrichment";
import type { MusicStory, PathRoute, PlaylistCandidateSource } from "./types";

type StoryCandidateInput = Pick<
  MusicStory,
  "rootTrack" | "nodes" | "edges" | "vibeSignature"
>;

export type CandidatePoolRow = {
  title: string;
  artist: string;
  source: PlaylistCandidateSource;
  family: string;
  score: number;
  pathRoute?: PathRoute;
  spotifyId?: string;
};

export type HoleSelectionRow = {
  title: string;
  artist: string;
  source: PlaylistCandidateSource;
  score: number;
  outcome: "selected" | "rejected" | "skipped";
  reason?: string;
};

export type HoleDiagnosis = {
  hole: PathRoute;
  name: string;
  candidatesConsidered: number;
  rejected: HoleSelectionRow[];
  skipped: HoleSelectionRow[];
  selected: Array<{ title: string; artist: string; source: PlaylistCandidateSource }>;
  fallbackUsed: boolean;
  fallbackTrigger?: {
    triggered: boolean;
    reason: string;
    codeLocation: string;
    conditions: Record<string, boolean | number | string>;
    seedSelected?: { id: string; label: string; family?: string };
    seedSelectionReason?: string;
    seedAllowedForHole?: boolean;
    fallbackTracksOffered: string[];
  };
};

export type RabbitHoleDiagnosisReport = {
  root: {
    title: string;
    artists: string;
    family: string;
    lastfmEnabled: boolean;
    artistTags: string[];
    trackTags: string[];
    blendedTags: string[];
    tagCoverage: string;
    blendRatio: string;
  };
  pool: {
    total: number;
    bySource: Record<string, number>;
    realCandidateCount: number;
    poolBuildFallbackFlag: boolean;
    first20: CandidatePoolRow[];
    spotifyDiagnostics: SimilarArtistSpotifyDiagnostic[];
    unresolvedSimilarArtists: UnresolvedSimilarArtist[];
    spotifyRateLimited: boolean;
  };
  holes: HoleDiagnosis[];
  verdict: string;
};

function normalise(value: string): string {
  return value.toLowerCase().trim();
}

function primaryArtistName(artistLabel: string): string {
  return artistLabel.split(/, | & /)[0]?.trim() ?? artistLabel;
}

function formatTags(tags: Array<{ name: string; count?: number }>, limit = 12): string[] {
  return tags.slice(0, limit).map((tag) => `${tag.name} (${tag.count ?? "?"})`);
}

function countBySource(pool: PoolTrack[]): Record<string, number> {
  const counts: Record<string, number> = {
    lastfm_similar_artist: 0,
    lastfm_tag_seed: 0,
    spotify_search: 0,
    musicbrainz_related_recording: 0,
    musicbrainz_credit: 0,
    curated_fallback: 0,
  };
  for (const track of pool) {
    counts[track.source] = (counts[track.source] ?? 0) + 1;
  }
  return counts;
}

/** Mirrors generateRabbitHoles selection with full audit — does not mutate production state. */
function auditHoleSelection(input: {
  pool: PoolTrack[];
  route: PathRoute;
  rootFamily: import("./music-family").MusicFamily;
  preferUnusedKeys: Set<string>;
  poolHasRealCandidates: boolean;
}): {
  candidatesConsidered: number;
  rejected: HoleSelectionRow[];
  skipped: HoleSelectionRow[];
  selectedTracks: PoolTrack[];
  fallbackUsed: boolean;
  fallbackTrigger: HoleDiagnosis["fallbackTrigger"];
} {
  const { pool, route, rootFamily, preferUnusedKeys, poolHasRealCandidates } = input;
  const routePool = poolForRoute(pool, route);
  const sorted = [...routePool]
    .map((track) => ({
      track,
      score:
        scoreForHole(track, route) -
        (preferUnusedKeys.has(dedupeKey(track)) ? 0.3 : 0),
    }))
    .sort((a, b) => b.score - a.score);

  const rejected: HoleSelectionRow[] = [];
  const skipped: HoleSelectionRow[] = [];
  const selected: PoolTrack[] = [];
  const artistCounts = new Map<string, number>();
  const localUsed = new Set<string>();

  for (const { track, score } of sorted) {
    if (selected.length >= TARGET_MAX) {
      skipped.push({
        title: track.title,
        artist: track.artist,
        source: track.source,
        score,
        outcome: "skipped",
        reason: `target max (${TARGET_MAX}) already reached`,
      });
      continue;
    }

    const key = dedupeKey(track);
    if (localUsed.has(key)) {
      skipped.push({
        title: track.title,
        artist: track.artist,
        source: track.source,
        score,
        outcome: "skipped",
        reason: "duplicate within hole",
      });
      continue;
    }

    const gate = isTrackAllowedForHole(track, route, rootFamily);
    if (!gate.allowed) {
      rejected.push({
        title: track.title,
        artist: track.artist,
        source: track.source,
        score,
        outcome: "rejected",
        reason: gate.reason ?? "family gate",
      });
      continue;
    }

    const artistKey = normalise(primaryArtistName(track.artist));
    const count = artistCounts.get(artistKey) ?? 0;
    const maxPerArtist = sorted.length >= TARGET_MAX ? 1 : 2;
    if (count >= maxPerArtist) {
      skipped.push({
        title: track.title,
        artist: track.artist,
        source: track.source,
        score,
        outcome: "skipped",
        reason: `max per artist (${maxPerArtist}) for ${artistKey}`,
      });
      continue;
    }

    selected.push(track);
    localUsed.add(key);
    artistCounts.set(artistKey, count + 1);
  }

  if (selected.length < TARGET_MIN) {
    for (const { track, score } of sorted) {
      if (selected.length >= TARGET_MIN) break;
      const key = dedupeKey(track);
      if (localUsed.has(key)) continue;
      const gate = isTrackAllowedForHole(track, route, rootFamily);
      if (!gate.allowed) continue;
      selected.push(track);
      localUsed.add(key);
      skipped.push({
        title: track.title,
        artist: track.artist,
        source: track.source,
        score,
        outcome: "selected",
        reason: `TARGET_MIN top-up (${TARGET_MIN})`,
      });
    }
  }

  const finalSelected = selected.slice(0, TARGET_MAX);
  const selectedRealCount = realCandidateCount(finalSelected);

  const fallbackSeed = pickBestFallbackSeed(rootFamily);
  const fallbackPool = fallbackSeedsForHole(route, rootFamily);
  const wouldTriggerFallback =
    !poolHasRealCandidates && selectedRealCount < HOLE_MIN_BEFORE_FALLBACK;

  let fallbackUsed = false;
  const fallbackSelected = [...finalSelected];

  if (wouldTriggerFallback) {
    for (const { track: seed, seedEntry } of fallbackPool) {
      if (fallbackSelected.length >= TARGET_MIN) break;
      const track = seedToTrack(seed, route, rootFamily, seedEntry);
      const key = dedupeKey(track);
      if (fallbackSelected.some((t) => dedupeKey(t) === key)) continue;
      const gate = isTrackAllowedForHole(track, route, rootFamily);
      if (!gate.allowed) continue;
      fallbackSelected.push(track);
      fallbackUsed = true;
    }
  }

  const familyId = fallbackSeed.id;
  const familyDefaultId = FAMILY_DEFAULT_SEED_ID[rootFamily] ?? familyId;

  return {
    candidatesConsidered: sorted.length,
    rejected,
    skipped,
    selectedTracks: fallbackSelected,
    fallbackUsed,
    fallbackTrigger: {
      triggered: wouldTriggerFallback,
      reason: wouldTriggerFallback
        ? `generateRabbitHoles L574-577: !poolHasRealCandidates (${!poolHasRealCandidates}) && realCandidateCount(selected) (${selectedRealCount}) < HOLE_MIN_BEFORE_FALLBACK (${HOLE_MIN_BEFORE_FALLBACK})`
        : poolHasRealCandidates
          ? "not triggered — pool has real Last.fm/Spotify candidates"
          : `not triggered — selected ${selectedRealCount} real candidates >= HOLE_MIN_BEFORE_FALLBACK (${HOLE_MIN_BEFORE_FALLBACK})`,
      codeLocation: "mini-playlist.ts generateRabbitHoles lines 574-577",
      conditions: {
        poolHasRealCandidates,
        selectedRealCount,
        selectedTotalCount: finalSelected.length,
        HOLE_MIN_BEFORE_FALLBACK,
        poolTotal: pool.length,
        poolRealTotal: realCandidateCount(pool),
      },
      seedSelected: wouldTriggerFallback
        ? {
            id: fallbackSeed.id,
            label: fallbackSeed.label,
            family: fallbackSeed.family,
          }
        : undefined,
      seedSelectionReason: wouldTriggerFallback
        ? `pickBestFallbackSeed(rootFamily=${rootFamily}) → FAMILY_DEFAULT_SEED_ID[${rootFamily}]="${familyDefaultId}" → seed id "${fallbackSeed.id}"`
        : undefined,
      seedAllowedForHole: fallbackPool.length > 0,
      fallbackTracksOffered: fallbackPool.map((s) => `${s.track.title} — ${s.track.artist}`),
    },
  };
}

function inferVerdict(report: Omit<RabbitHoleDiagnosisReport, "verdict">): string {
  const { pool, holes } = report;
  const allFallback = holes.every((h) => h.fallbackUsed);
  const anyFallback = holes.some((h) => h.fallbackUsed);

  if (pool.realCandidateCount === 0) {
    return "FAILURE IN CANDIDATE GENERATION: pool has zero Last.fm/Spotify candidates — Spotify search or Last.fm track resolution is likely failing (rate limit, missing API key, or empty similar-artist results).";
  }

  if (pool.realCandidateCount > 0 && anyFallback) {
    return "FAILURE IN FALLBACK CONDITION: pool has real candidates but fallback still triggered — inspect fallbackTrigger.conditions per hole.";
  }

  if (pool.realCandidateCount > 0 && !anyFallback) {
    const adjacent = holes.find((h) => h.hole === "adjacent");
    const familiar = holes.find((h) => h.hole === "familiar");
    if (
      adjacent &&
      familiar &&
      adjacent.selected.map((t) => t.title).join() === familiar.selected.map((t) => t.title).join()
    ) {
      return "FAILURE IN HOLE SELECTION: pool is healthy but Familiar and Adjacent selected identical tracks — hole scoring/ranking not differentiating.";
    }
    return "POOL HEALTHY: candidate generation succeeded; hole selection produced distinct real-candidate holes.";
  }

  if (allFallback) {
    return "FAILURE IN CANDIDATE GENERATION: all holes used curated fallback despite checks — pool was empty of real candidates.";
  }

  return "INCONCLUSIVE: review sections above.";
}

export async function buildRabbitHoleDiagnosisReport(
  story: StoryCandidateInput,
): Promise<RabbitHoleDiagnosisReport> {
  const rootArtistName =
    story.rootTrack.artists[0]?.name ?? formatArtists(story.rootTrack);

  const [artistTags, trackTags, enrichment, poolResult] = await Promise.all([
    isLastfmEnabled() ? getLastfmArtistTags(rootArtistName) : Promise.resolve([]),
    isLastfmEnabled()
      ? getLastfmTrackTags(rootArtistName, story.rootTrack.title)
      : Promise.resolve([]),
    isLastfmEnabled()
      ? enrichRootTags({ artistName: rootArtistName, trackTitle: story.rootTrack.title })
      : Promise.resolve(null),
    buildCandidatePool(story),
  ]);

  const { pool, fallbackUsed: poolBuildFallbackFlag, rootMusicFamily, spotifyDiagnostics, unresolvedSimilarArtists } = poolResult;
  const poolHasRealCandidates = realCandidateCount(pool) > 0;
  const preferUnusedKeys = new Set<string>();
  const holes: HoleDiagnosis[] = [];

  for (const hole of RABBIT_HOLES) {
    const audit = auditHoleSelection({
      pool,
      route: hole.route,
      rootFamily: rootMusicFamily,
      preferUnusedKeys,
      poolHasRealCandidates,
    });

    for (const track of audit.selectedTracks) {
      preferUnusedKeys.add(dedupeKey(track));
    }

    holes.push({
      hole: hole.route,
      name: hole.name,
      candidatesConsidered: audit.candidatesConsidered,
      rejected: audit.rejected,
      skipped: audit.skipped,
      selected: audit.selectedTracks.map((t) => ({
        title: t.title,
        artist: t.artist,
        source: t.source,
      })),
      fallbackUsed: audit.fallbackUsed,
      fallbackTrigger: audit.fallbackTrigger,
    });
  }

  const reportBody = {
    root: {
      title: story.rootTrack.title,
      artists: formatArtists(story.rootTrack),
      family: rootMusicFamily,
      lastfmEnabled: isLastfmEnabled(),
      artistTags: formatTags(artistTags),
      trackTags: formatTags(trackTags),
      blendedTags: enrichment ? formatTags(enrichment.tags) : [],
      tagCoverage: enrichment?.coverage ?? "n/a",
      blendRatio: enrichment
        ? `${Math.round(enrichment.blendRatio.track * 100)}% track / ${Math.round(enrichment.blendRatio.artist * 100)}% artist`
        : "n/a",
    },
    pool: {
      total: pool.length,
      bySource: countBySource(pool),
      realCandidateCount: realCandidateCount(pool),
      poolBuildFallbackFlag,
      first20: pool.slice(0, 20).map((track) => ({
        title: track.title,
        artist: track.artist,
        source: track.source,
        family: resolveCandidateFamily(track),
        score: track.confidence,
        pathRoute: track.pathRoute,
        spotifyId: track.spotifyId,
      })),
      spotifyDiagnostics,
      unresolvedSimilarArtists,
      spotifyRateLimited: isSpotifyRateLimited(),
    },
    holes,
  };

  return {
    ...reportBody,
    verdict: inferVerdict(reportBody),
  };
}

export function printRabbitHoleDiagnosisReport(report: RabbitHoleDiagnosisReport): void {
  console.log("\n" + "=".repeat(72));
  console.log("RABBIT HOLE END-TO-END DIAGNOSIS");
  console.log("=".repeat(72));

  console.log("\n## 1. Root song");
  console.log(`  title:         ${report.root.title}`);
  console.log(`  artists:       ${report.root.artists}`);
  console.log(`  root family:   ${report.root.family}`);
  console.log(`  Last.fm enabled: ${report.root.lastfmEnabled}`);
  console.log(`  tag coverage:  ${report.root.tagCoverage} (${report.root.blendRatio})`);
  console.log(`  artist tags:   ${report.root.artistTags.join(", ") || "(none)"}`);
  console.log(`  track tags:    ${report.root.trackTags.join(", ") || "(none)"}`);
  console.log(`  blended tags:  ${report.root.blendedTags.join(", ") || "(none)"}`);

  console.log("\n## 2. Candidate pool (before holes)");
  console.log(`  total:              ${report.pool.total}`);
  console.log(`  real candidates:    ${report.pool.realCandidateCount}`);
  console.log(`  pool build fallback flag: ${report.pool.poolBuildFallbackFlag}`);
  console.log("  by source:");
  for (const [source, count] of Object.entries(report.pool.bySource)) {
    if (count > 0) console.log(`    ${source}: ${count}`);
  }
  console.log("  first 20:");
  for (const row of report.pool.first20) {
    console.log(
      `    • ${row.title} — ${row.artist} [${row.source}] family=${row.family} score=${row.score.toFixed(3)} route=${row.pathRoute ?? "?"} spotify=${row.spotifyId ?? "none"}`,
    );
  }

  if (report.pool.spotifyDiagnostics.length > 0) {
    console.log("\n  Spotify search diagnostics (Last.fm similar artists):");
    console.log(`  rate limited: ${report.pool.spotifyRateLimited ? "YES" : "no"}`);
    for (const row of report.pool.spotifyDiagnostics.slice(0, 15)) {
      console.log(
        `\n    ${row.artistName}${row.lastfmMatchScore !== undefined ? ` (match ${row.lastfmMatchScore.toFixed(2)})` : ""} → ${row.selectedTrackCount} track(s)`,
      );
      if (row.unresolvedReason) console.log(`      unresolved: ${row.unresolvedReason}`);
      for (const query of row.queries) {
        console.log(
          `      q=${query.query} status=${query.status} results=${query.resultCount} selected=${query.selectedCount}${query.rateLimited ? " [429]" : ""}${query.rejectionReason ? ` reject=${query.rejectionReason}` : ""}`,
        );
      }
    }
    if (report.pool.spotifyDiagnostics.length > 15) {
      console.log(`    … and ${report.pool.spotifyDiagnostics.length - 15} more artists`);
    }
  }

  if (report.pool.unresolvedSimilarArtists.length > 0) {
    console.log("\n  Unresolved Last.fm similar artists (debug only — not in playlist UI):");
    for (const row of report.pool.unresolvedSimilarArtists.slice(0, 10)) {
      console.log(`    ${row.lastfmArtist} (match ${row.lastfmMatchScore.toFixed(2)}): ${row.reason}`);
    }
    if (report.pool.unresolvedSimilarArtists.length > 10) {
      console.log(`    … and ${report.pool.unresolvedSimilarArtists.length - 10} more`);
    }
  }

  for (const hole of report.holes) {
    console.log(`\n## 3. Hole: ${hole.name} (${hole.hole})`);
    console.log(`  candidates considered: ${hole.candidatesConsidered}`);
    console.log(`  rejected: ${hole.rejected.length}`);
    for (const row of hole.rejected.slice(0, 10)) {
      console.log(`    ✗ ${row.title} — ${row.artist} [${row.source}] ${row.reason}`);
    }
    if (hole.rejected.length > 10) {
      console.log(`    … and ${hole.rejected.length - 10} more rejections`);
    }
    console.log(`  skipped: ${hole.skipped.length}`);
    for (const row of hole.skipped.slice(0, 5)) {
      console.log(`    – ${row.title} — ${row.artist} ${row.reason}`);
    }
    console.log(`  final selected (${hole.selected.length}):`);
    for (const row of hole.selected) {
      console.log(`    ✓ ${row.title} — ${row.artist} [${row.source}]`);
    }
    console.log(`  fallback used: ${hole.fallbackUsed ? "YES" : "no"}`);

    console.log("\n## 4. Fallback trigger");
    if (hole.fallbackTrigger) {
      console.log(`  triggered: ${hole.fallbackTrigger.triggered}`);
      console.log(`  reason: ${hole.fallbackTrigger.reason}`);
      console.log(`  code: ${hole.fallbackTrigger.codeLocation}`);
      console.log("  conditions:", JSON.stringify(hole.fallbackTrigger.conditions, null, 2));
      if (hole.fallbackTrigger.seedSelected) {
        console.log(
          `  seed selected: ${hole.fallbackTrigger.seedSelected.label} (${hole.fallbackTrigger.seedSelected.id}, family=${hole.fallbackTrigger.seedSelected.family})`,
        );
        console.log(`  seed selection: ${hole.fallbackTrigger.seedSelectionReason}`);
        console.log(`  seed allowed for hole: ${hole.fallbackTrigger.seedAllowedForHole}`);
        console.log(`  fallback tracks offered: ${hole.fallbackTrigger.fallbackTracksOffered.join("; ")}`);
      }
    }
  }

  console.log("\n## VERDICT");
  console.log(`  ${report.verdict}`);
  console.log("=".repeat(72));
}
