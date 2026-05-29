import type { SpotifyNormalizedTrack } from "./spotify";

const API_ROOT = "https://musicbrainz.org/ws/2";
const WEB_ROOT = "https://musicbrainz.org";

/** MusicBrainz allows ~1 request per second per application. */
const MIN_REQUEST_INTERVAL_MS = 1100;
const MAX_RETRIES = 2;

const USER_AGENT =
  process.env.MUSICBRAINZ_USER_AGENT ??
  "MusicStory/0.1.0 (+https://musicbrainz.org/doc/MusicBrainz_API)";

const WRITER_RELATION_TYPES = new Set([
  "writer",
  "composer",
  "lyricist",
  "arranger",
  "author",
]);

const PRODUCER_RELATION_TYPES = new Set([
  "producer",
  "co-producer",
  "executive producer",
]);

const RELATED_RECORDING_TYPES = new Set([
  "cover",
  "edit",
  "medley",
  "remix",
  "performance",
  "sampled",
  "samples",
  "based on",
]);

export type MusicBrainzPerson = {
  id: string;
  name: string;
  role: string;
  sourceUrl: string;
};

export type MusicBrainzRelease = {
  id: string;
  title: string;
  date: string | null;
  country: string | null;
  status: string | null;
  sourceUrl: string;
};

export type MusicBrainzLabel = {
  id: string;
  name: string;
  catalogNumber: string | null;
  sourceUrl: string;
};

export type MusicBrainzWork = {
  id: string;
  title: string;
  iswcs: string[];
  writers: MusicBrainzPerson[];
  sourceUrl: string;
};

export type MusicBrainzRelatedRecording = {
  id: string;
  title: string;
  relationship: string;
  sourceUrl: string;
};

export type MusicBrainzRecordingMatch = {
  id: string;
  title: string;
  sourceUrl: string;
};

export type MusicBrainzEnrichment = {
  matched: boolean;
  confidence: number;
  recording: MusicBrainzRecordingMatch | null;
  writers: MusicBrainzPerson[];
  producers: MusicBrainzPerson[];
  releases: MusicBrainzRelease[];
  labels: MusicBrainzLabel[];
  works: MusicBrainzWork[];
  relatedRecordings: MusicBrainzRelatedRecording[];
  sourceUrls: string[];
  matchNotes: string | null;
};

type MbSearchRecording = {
  id: string;
  score: number;
  title: string;
  "first-release-date"?: string;
  "artist-credit"?: Array<{
    name: string;
    artist?: { id: string; name: string };
  }>;
  releases?: Array<{ id: string; title: string; date?: string }>;
};

type MbRelation = {
  type: string;
  direction: string;
  "target-type": string;
  artist?: { id: string; name: string };
  work?: { id: string; title: string; iswcs?: string[] };
  recording?: { id: string; title: string };
};

type MbRecording = {
  id: string;
  title: string;
  length?: number;
  "first-release-date"?: string;
  "artist-credit"?: Array<{
    name: string;
    artist?: { id: string; name: string };
  }>;
  relations?: MbRelation[];
  releases?: Array<{
    id: string;
    title: string;
    date?: string;
    country?: string;
    status?: string;
  }>;
};

type MbWork = {
  id: string;
  title: string;
  iswcs?: string[];
  relations?: MbRelation[];
};

type MbRelease = {
  id: string;
  "label-info"?: Array<{
    "catalog-number"?: string;
    label?: { id: string; name: string };
  }>;
};

let lastRequestAt = 0;
let requestQueue: Promise<void> = Promise.resolve();

function entityUrl(type: string, id: string): string {
  return `${WEB_ROOT}/${type}/${id}`;
}

function escapeLucene(value: string): string {
  return value.replace(/[+\-&|!(){}[\]^"~*?:\\/]/g, "\\$&");
}

function normalizeForMatch(value: string): string {
  return value
    .toLowerCase()
    .normalize("NFD")
    .replace(/\p{M}/gu, "")
    .replace(/[^\w\s]/g, " ")
    .replace(/\s+/g, " ")
    .trim();
}

function titleSimilarity(a: string, b: string): number {
  const left = normalizeForMatch(a);
  const right = normalizeForMatch(b);

  if (!left || !right) return 0;
  if (left === right) return 1;

  if (left.includes(right) || right.includes(left)) {
    const shorter = Math.min(left.length, right.length);
    const longer = Math.max(left.length, right.length);
    return shorter / longer;
  }

  const leftTokens = new Set(left.split(" "));
  const rightTokens = right.split(" ");
  const overlap = rightTokens.filter((token) => leftTokens.has(token)).length;
  return overlap / Math.max(leftTokens.size, rightTokens.length);
}

function artistMatches(
  spotifyArtists: SpotifyNormalizedTrack["artists"],
  artistCredit: MbSearchRecording["artist-credit"] = [],
): boolean {
  const mbNames = artistCredit.flatMap((credit) => [
    credit.name,
    credit.artist?.name,
  ]);
  const normalizedMb = mbNames
    .filter(Boolean)
    .map((name) => normalizeForMatch(name!));

  return spotifyArtists.some((artist) => {
    const normalizedSpotify = normalizeForMatch(artist.name);
    return normalizedMb.some(
      (mbName) =>
        mbName === normalizedSpotify ||
        mbName.includes(normalizedSpotify) ||
        normalizedSpotify.includes(mbName),
    );
  });
}

function releaseYear(value: string | undefined): number | null {
  if (!value) return null;
  const year = Number.parseInt(value.slice(0, 4), 10);
  return Number.isNaN(year) ? null : year;
}

function scoreCandidate(
  track: SpotifyNormalizedTrack,
  candidate: MbSearchRecording,
): number {
  const titleScore = titleSimilarity(track.name, candidate.title);
  const artistOk = artistMatches(track.artists, candidate["artist-credit"]);

  if (!artistOk || titleScore < 0.85) return 0;

  const searchScore = Math.min(candidate.score / 100, 1);
  let score = searchScore * 0.35 + titleScore * 0.4 + 0.2;

  const spotifyYear = releaseYear(track.releaseDate);
  const mbYear =
    releaseYear(candidate["first-release-date"]) ??
    releaseYear(candidate.releases?.[0]?.date);

  if (spotifyYear && mbYear && spotifyYear === mbYear) {
    score += 0.05;
  }

  const albumMatch = candidate.releases?.some(
    (release) =>
      titleSimilarity(release.title, track.album.name) >= 0.85,
  );
  if (albumMatch) score += 0.05;

  return Math.min(score, 1);
}

function pickBestRecordingMatch(
  track: SpotifyNormalizedTrack,
  candidates: MbSearchRecording[],
): { candidate: MbSearchRecording; confidence: number } | null {
  const scored = candidates
    .map((candidate) => ({
      candidate,
      confidence: scoreCandidate(track, candidate),
    }))
    .filter((entry) => entry.confidence >= 0.72)
    .sort((a, b) => b.confidence - a.confidence);

  return scored[0] ?? null;
}

async function throttle(): Promise<void> {
  const run = async () => {
    const elapsed = Date.now() - lastRequestAt;
    const wait = Math.max(0, MIN_REQUEST_INTERVAL_MS - elapsed);
    if (wait > 0) {
      await new Promise((resolve) => setTimeout(resolve, wait));
    }
    lastRequestAt = Date.now();
  };

  requestQueue = requestQueue.then(run, run);
  await requestQueue;
}

async function mbFetch<T>(path: string, attempt = 0): Promise<T | null> {
  await throttle();

  const response = await fetch(`${API_ROOT}${path}`, {
    headers: {
      "User-Agent": USER_AGENT,
      Accept: "application/json",
    },
    next: { revalidate: 0 },
  });

  if (response.status === 404) return null;

  if (response.status === 503 || response.status === 429) {
    if (attempt < MAX_RETRIES) {
      await new Promise((resolve) => setTimeout(resolve, 1500 * (attempt + 1)));
      return mbFetch<T>(path, attempt + 1);
    }
    return null;
  }

  if (!response.ok) return null;

  return (await response.json()) as T;
}

function emptyEnrichment(matchNotes: string | null = null): MusicBrainzEnrichment {
  return {
    matched: false,
    confidence: 0,
    recording: null,
    writers: [],
    producers: [],
    releases: [],
    labels: [],
    works: [],
    relatedRecordings: [],
    sourceUrls: [],
    matchNotes,
  };
}

async function searchRecordings(
  track: SpotifyNormalizedTrack,
): Promise<MbSearchRecording[]> {
  const primaryArtist = track.artists[0]?.name;
  if (!primaryArtist) return [];

  const query = [
    `recording:"${escapeLucene(track.name)}"`,
    `AND artist:"${escapeLucene(primaryArtist)}"`,
  ].join(" ");

  const data = await mbFetch<{ recordings?: MbSearchRecording[] }>(
    `/recording?query=${encodeURIComponent(query)}&limit=10&fmt=json`,
  );

  return data?.recordings ?? [];
}

async function fetchRecordingDetails(mbid: string): Promise<MbRecording | null> {
  const inc = [
    "artist-credits",
    "releases",
    "work-rels",
    "artist-rels",
    "recording-rels",
    "url-rels",
  ].join("+");

  return mbFetch<MbRecording>(`/recording/${mbid}?inc=${inc}&fmt=json`);
}

async function fetchWorkDetails(mbid: string): Promise<MbWork | null> {
  return mbFetch<MbWork>(`/work/${mbid}?inc=artist-rels&fmt=json`);
}

async function fetchReleaseLabels(mbid: string): Promise<MbRelease | null> {
  return mbFetch<MbRelease>(`/release/${mbid}?inc=labels&fmt=json`);
}

function dedupeById<T extends { id: string }>(items: T[]): T[] {
  const seen = new Set<string>();
  return items.filter((item) => {
    if (seen.has(item.id)) return false;
    seen.add(item.id);
    return true;
  });
}

function extractProducers(relations: MbRelation[] = []): MusicBrainzPerson[] {
  return dedupeById(
    relations
      .filter(
        (rel) =>
          rel["target-type"] === "artist" &&
          PRODUCER_RELATION_TYPES.has(rel.type.toLowerCase()) &&
          rel.artist,
      )
      .map((rel) => ({
        id: rel.artist!.id,
        name: rel.artist!.name,
        role: rel.type,
        sourceUrl: entityUrl("artist", rel.artist!.id),
      })),
  );
}

function extractRelatedRecordings(
  relations: MbRelation[] = [],
): MusicBrainzRelatedRecording[] {
  return dedupeById(
    relations
      .filter(
        (rel) =>
          rel["target-type"] === "recording" &&
          RELATED_RECORDING_TYPES.has(rel.type.toLowerCase()) &&
          rel.recording,
      )
      .map((rel) => ({
        id: rel.recording!.id,
        title: rel.recording!.title,
        relationship: rel.type,
        sourceUrl: entityUrl("recording", rel.recording!.id),
      })),
  );
}

function mapReleases(
  recording: MbRecording,
  track: SpotifyNormalizedTrack,
): MusicBrainzRelease[] {
  const releases = recording.releases ?? [];

  const ranked = [...releases].sort((a, b) => {
    const aAlbumMatch =
      titleSimilarity(a.title, track.album.name) >= 0.85 ? 1 : 0;
    const bAlbumMatch =
      titleSimilarity(b.title, track.album.name) >= 0.85 ? 1 : 0;
    if (aAlbumMatch !== bAlbumMatch) return bAlbumMatch - aAlbumMatch;
    if (a.status === "Official" && b.status !== "Official") return -1;
    if (b.status === "Official" && a.status !== "Official") return 1;
    return (b.date ?? "").localeCompare(a.date ?? "");
  });

  return dedupeById(
    ranked.slice(0, 8).map((release) => ({
      id: release.id,
      title: release.title,
      date: release.date ?? null,
      country: release.country ?? null,
      status: release.status ?? null,
      sourceUrl: entityUrl("release", release.id),
    })),
  );
}

async function buildWorks(
  relations: MbRelation[] = [],
): Promise<MusicBrainzWork[]> {
  const workRelations = relations.filter(
    (rel) => rel["target-type"] === "work" && rel.work,
  );

  const works: MusicBrainzWork[] = [];

  for (const rel of workRelations.slice(0, 3)) {
    const workId = rel.work!.id;
    const details = await fetchWorkDetails(workId);

    const writers = dedupeById(
      (details?.relations ?? [])
        .filter(
          (workRel) =>
            workRel["target-type"] === "artist" &&
            WRITER_RELATION_TYPES.has(workRel.type.toLowerCase()) &&
            workRel.artist,
        )
        .map((workRel) => ({
          id: workRel.artist!.id,
          name: workRel.artist!.name,
          role: workRel.type,
          sourceUrl: entityUrl("artist", workRel.artist!.id),
        })),
    );

    works.push({
      id: workId,
      title: details?.title ?? rel.work!.title,
      iswcs: details?.iswcs ?? rel.work!.iswcs ?? [],
      writers,
      sourceUrl: entityUrl("work", workId),
    });
  }

  return works;
}

async function buildLabels(
  releases: MusicBrainzRelease[],
): Promise<MusicBrainzLabel[]> {
  const labels: MusicBrainzLabel[] = [];

  for (const release of releases.slice(0, 3)) {
    const details = await fetchReleaseLabels(release.id);
    for (const info of details?.["label-info"] ?? []) {
      if (!info.label) continue;
      labels.push({
        id: info.label.id,
        name: info.label.name,
        catalogNumber: info["catalog-number"] ?? null,
        sourceUrl: entityUrl("label", info.label.id),
      });
    }
  }

  return dedupeById(labels);
}

export async function enrichTrackFromSpotify(
  track: SpotifyNormalizedTrack,
): Promise<MusicBrainzEnrichment> {
  try {
    const searchResults = await searchRecordings(track);
    if (searchResults.length === 0) {
      return emptyEnrichment("No MusicBrainz recordings matched the search query.");
    }

    const best = pickBestRecordingMatch(track, searchResults);
    if (!best) {
      return emptyEnrichment(
        "Candidates found but none met the conservative match threshold.",
      );
    }

    const recording = await fetchRecordingDetails(best.candidate.id);
    if (!recording) {
      return emptyEnrichment("Matched recording could not be loaded from MusicBrainz.");
    }

    const relations = recording.relations ?? [];
    const releases = mapReleases(recording, track);
    const works = await buildWorks(relations);
    const labels = await buildLabels(releases);

    const workWriters = works.flatMap((work) => work.writers);
    const producers = extractProducers(relations);
    const relatedRecordings = extractRelatedRecordings(relations);

    const recordingMatch: MusicBrainzRecordingMatch = {
      id: recording.id,
      title: recording.title,
      sourceUrl: entityUrl("recording", recording.id),
    };

    const sourceUrls = [
      recordingMatch.sourceUrl,
      ...workWriters.map((writer) => writer.sourceUrl),
      ...producers.map((producer) => producer.sourceUrl),
      ...releases.map((release) => release.sourceUrl),
      ...labels.map((label) => label.sourceUrl),
      ...works.map((work) => work.sourceUrl),
      ...relatedRecordings.map((related) => related.sourceUrl),
    ];

    return {
      matched: true,
      confidence: Number(best.confidence.toFixed(2)),
      recording: recordingMatch,
      writers: dedupeById(workWriters),
      producers,
      releases,
      labels,
      works,
      relatedRecordings,
      sourceUrls: [...new Set(sourceUrls)],
      matchNotes: null,
    };
  } catch {
    return emptyEnrichment("MusicBrainz enrichment failed unexpectedly.");
  }
}

/** Resets rate-limit queue state — useful in tests. */
export function resetMusicBrainzClient(): void {
  lastRequestAt = 0;
  requestQueue = Promise.resolve();
}
