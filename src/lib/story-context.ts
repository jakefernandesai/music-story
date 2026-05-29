import type { MusicBrainzEnrichment } from "./musicbrainz";
import { searchTracksByArtist } from "./spotify";
import { fetchTrackDetails } from "./spotify";
import type {
  ConnectedSpotifyTrack,
  MusicStory,
  PeopleByRole,
  PersonCredit,
  ReleaseWorld,
  StoryNode,
  Track,
} from "./types";

function normalise(value: string): string {
  return value.toLowerCase().trim();
}

function dedupePeople(people: PersonCredit[]): PersonCredit[] {
  const seen = new Set<string>();
  const result: PersonCredit[] = [];
  for (const person of people) {
    const key = normalise(person.name);
    if (seen.has(key)) continue;
    seen.add(key);
    result.push(person);
  }
  return result;
}

function parseTitleArtist(title: string): { title: string; artist: string } {
  const parts = title.split(" - ");
  if (parts.length >= 2) {
    return { artist: parts[0]!.trim(), title: parts.slice(1).join(" - ").trim() };
  }
  return { title, artist: "" };
}

export function buildPeopleFromStory(
  story: Pick<MusicStory, "nodes" | "rootTrack">,
  enrichment: MusicBrainzEnrichment,
): PeopleByRole {
  const rootArtistNames = new Set(
    story.rootTrack.artists.map((artist) => normalise(artist.name)),
  );

  const producers = dedupePeople(
    enrichment.producers.map((person) => ({
      name: person.name,
      role: person.role,
    })),
  );

  const writers = dedupePeople([
    ...enrichment.writers.map((person) => ({
      name: person.name,
      role: person.role,
    })),
    ...story.nodes
      .filter((node) => node.type === "songwriter")
      .map((node) => ({ name: node.title, role: node.subtitle ?? "Writer" })),
  ]);

  const performers = dedupePeople([
    ...story.rootTrack.artists.map((artist) => ({
      name: artist.name,
      role: "Performer",
    })),
    ...story.nodes
      .filter((node) => node.type === "artist")
      .filter((node) => !rootArtistNames.has(normalise(node.title)))
      .map((node) => ({ name: node.title, role: "Performer" })),
    ...story.nodes
      .filter((node) => node.type === "collaborator")
      .map((node) => ({
        name: node.title,
        role: node.subtitle ?? "Collaborator",
      })),
  ]);

  const remixers = dedupePeople([
    ...story.nodes
      .filter((node) => node.type === "remix")
      .map((node) => {
        const parsed = parseTitleArtist(node.title);
        return {
          name: parsed.artist || node.subtitle || node.title,
          role: node.subtitle ?? "Remix",
        };
      }),
    ...enrichment.relatedRecordings
      .filter((related) => /remix|edit/i.test(related.relationship))
      .map((related) => {
        const parsed = parseTitleArtist(related.title);
        return {
          name: parsed.artist || related.title,
          role: related.relationship,
        };
      }),
  ]);

  const engineers = dedupePeople(
    enrichment.producers
      .filter((person) => /engineer|mix|master/i.test(person.role))
      .map((person) => ({ name: person.name, role: person.role })),
  );

  return { producers, writers, performers, remixers, engineers };
}

export function buildReleaseWorld(
  rootTrack: Track,
  enrichment: MusicBrainzEnrichment,
  nodes: StoryNode[],
): ReleaseWorld | null {
  const labelNode = nodes.find((node) => node.type === "label");
  const release = enrichment.releases[0];
  const catalogMatch = labelNode?.subtitle?.match(/Catalog\s+(.+)/i);

  const world: ReleaseWorld = {
    albumTitle: rootTrack.albumTitle,
    releaseYear: rootTrack.releaseYear,
    releaseDate: release?.date ?? null,
    label: labelNode?.title ?? enrichment.labels[0]?.name,
    catalogNumber:
      catalogMatch?.[1] ?? enrichment.labels[0]?.catalogNumber ?? undefined,
    country: release?.country ?? undefined,
    format: release?.status ?? undefined,
  };

  const extraFields = [
    world.label,
    world.catalogNumber,
    world.country,
    world.format,
    world.releaseDate,
  ].filter(Boolean).length;

  if (extraFields === 0) return null;
  return world;
}

export function releaseWorldIsRich(world: ReleaseWorld | null): boolean {
  if (!world) return false;
  return Boolean(world.label || world.country || world.catalogNumber || world.format);
}

export async function resolveConnectedTracks(
  enrichment: MusicBrainzEnrichment,
  rootTrackId: string,
): Promise<ConnectedSpotifyTrack[]> {
  const connected: ConnectedSpotifyTrack[] = [];
  const seenUris = new Set<string>();

  for (const related of enrichment.relatedRecordings.slice(0, 12)) {
    const parsed = parseTitleArtist(related.title);
    const searchArtist = parsed.artist;
    const searchTitle = parsed.title;

    let results = searchArtist
      ? await searchTracksByArtist(searchArtist, 5)
      : [];

    let match = results.find((track) =>
      normalise(track.name).includes(normalise(searchTitle)),
    );

    if (!match && searchArtist) {
      results = await searchTracksByArtist(searchTitle, 3);
      match = results[0];
    }

    if (!match || match.id === rootTrackId || seenUris.has(match.uri)) continue;

    seenUris.add(match.uri);
    connected.push({
      title: match.name,
      artist: match.artistLabel,
      spotifyUri: match.uri,
      spotifyId: match.id,
      previewUrl: match.previewUrl,
      artworkUrl: match.imageUrl,
      relationship: related.relationship,
    });
  }

  const ids = connected
    .filter((track) => !track.previewUrl || !track.artworkUrl)
    .map((track) => track.spotifyId);

  if (ids.length > 0) {
    const details = await fetchTrackDetails(ids);
    return connected.map((track) => {
      const extra = details.get(track.spotifyId);
      if (!extra) return track;
      return {
        ...track,
        previewUrl: track.previewUrl ?? extra.previewUrl,
        artworkUrl: track.artworkUrl ?? extra.imageUrl,
      };
    });
  }

  return connected;
}
