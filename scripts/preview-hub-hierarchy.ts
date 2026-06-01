/**
 * Simulates adaptive hub hierarchy for fixture worlds + story stubs.
 * Run: npx tsx scripts/preview-hub-hierarchy.ts
 */
import { STATIC_RECOMMENDATION_WORLDS } from "../src/lib/fixtures/worlds";
import { formatRichnessReport } from "../src/lib/track-hub-scoring";
import { buildFacetPortalsWithHierarchy } from "../src/lib/track-hub-summaries";
import type { PeopleByRole, PlaylistCandidate, Track } from "../src/lib/types";

function emptyPeople(): PeopleByRole {
  return {
    producers: [],
    writers: [],
    performers: [],
    remixers: [],
    engineers: [],
  };
}

function playlistFromFixture(
  world: (typeof STATIC_RECOMMENDATION_WORLDS)[number],
): PlaylistCandidate {
  const tracks = world.tracks.map((t) => ({
    title: t.title,
    artist: t.artist,
    reason: t.reason,
    confidence: 0.8,
    source: "curated_fallback" as const,
    artworkUrl: t.artworkUrl ?? null,
    previewUrl: t.previewUrl,
    spotifyUri: t.spotifyUri ?? undefined,
    spotifyId: t.spotifyId ?? undefined,
  }));

  return {
    id: `fixture-${world.slug}`,
    name: `${world.label} path`,
    description: "Fixture playlist",
    vibe: "fixture",
    trackCount: tracks.length,
    seedTrackId: world.rootTrack.spotifyId,
    tracks,
  };
}

function rootTrackFromFixture(
  world: (typeof STATIC_RECOMMENDATION_WORLDS)[number],
): Track {
  return {
    id: world.rootTrack.spotifyId,
    title: world.rootTrack.title,
    artists: [{ id: "a1", name: world.rootTrack.artist }],
    albumTitle: "Fixture Album",
    artworkUrl: "https://picsum.photos/seed/fixture/400/400",
    releaseYear: 2024,
    durationMs: 200000,
    spotifyUrl: world.rootTrack.spotifyUrl,
    spotifyId: world.rootTrack.spotifyId,
  };
}

const emptyStory = { nodes: [] as never[], edges: [] as never[] };

console.log("=== Fixture worlds (rich playlist, empty story graph) ===\n");

for (const world of STATIC_RECOMMENDATION_WORLDS) {
  const rootTrack = rootTrackFromFixture(world);
  const { breakdowns, featuredId, portals, worldDescription } =
    buildFacetPortalsWithHierarchy({
    rootTrack,
    people: emptyPeople(),
    releaseWorld: null,
    connectedTracks: [],
    playlist: playlistFromFixture(world),
    vibeSignature: null,
    storyForScene: { ...emptyStory, rootTrack },
  });

  console.log(formatRichnessReport(world.label, breakdowns, featuredId));
  console.log(`  world: ${worldDescription}`);
  console.log(
    `  grid order: ${portals.map((p) => `${p.id}(${p.layout})`).join(" → ")}\n`,
  );
}

console.log("=== Sparse live-like (no playlist, release only) ===\n");
{
  const world = STATIC_RECOMMENDATION_WORLDS[0]!;
  const rootTrack = rootTrackFromFixture(world);
  const { breakdowns, featuredId, portals, worldDescription } =
    buildFacetPortalsWithHierarchy({
    rootTrack,
    people: emptyPeople(),
    releaseWorld: {
      albumTitle: rootTrack.albumTitle,
      releaseYear: 2024,
      label: "Deskpop",
    },
    connectedTracks: [],
    playlist: undefined,
    vibeSignature: null,
    storyForScene: { ...emptyStory, rootTrack },
  });
  console.log(formatRichnessReport("Sparse", breakdowns, featuredId));
  console.log(`  world: ${worldDescription}`);
  console.log(
    `  grid order: ${portals.map((p) => `${p.id}(${p.layout})`).join(" → ")}\n`,
  );
}

console.log("=== Rich scene (no playlist) ===\n");
{
  const world = STATIC_RECOMMENDATION_WORLDS[0]!;
  const rootTrack = rootTrackFromFixture(world);
  const { breakdowns, featuredId, portals, worldDescription } =
    buildFacetPortalsWithHierarchy({
    rootTrack,
    people: emptyPeople(),
    releaseWorld: null,
    connectedTracks: [],
    playlist: undefined,
    vibeSignature: null,
    storyForScene: {
      rootTrack,
      nodes: [
        {
          id: "g1",
          type: "genre",
          title: "hyperpop",
          source: "musicbrainz",
          confidence: 0.9,
        },
        {
          id: "g2",
          type: "genre",
          title: "electronic",
          source: "musicbrainz",
          confidence: 0.9,
        },
        {
          id: "s1",
          type: "scene",
          title: "PC Music",
          source: "inferred",
          confidence: 0.7,
        },
      ],
      edges: [],
    },
  });
  console.log(formatRichnessReport("Scene-rich", breakdowns, featuredId));
  console.log(`  world: ${worldDescription}`);
  console.log(
    `  grid order: ${portals.map((p) => `${p.id}(${p.layout})`).join(" → ")}\n`,
  );
}
