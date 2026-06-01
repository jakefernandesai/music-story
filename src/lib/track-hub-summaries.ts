import { groupStoryNodes } from "@/lib/story-sections";
import { releaseWorldIsRich } from "@/lib/story-context-utils";
import { buildFacetInvitation, facetDetailHint } from "@/lib/facet-invitations";
import { buildWorldDescription } from "@/lib/world-description";
import {
  assignFacetLayouts,
  type FacetRichnessBreakdown,
} from "@/lib/track-hub-scoring";
import type {
  ConnectedSpotifyTrack,
  MusicStory,
  PeopleByRole,
  PersonCredit,
  PlaylistCandidate,
  RabbitHoleDiscoveryState,
  ReleaseWorld,
  Track,
  VibeSignature,
} from "@/lib/types";

export type FacetId =
  | "playlist"
  | "people"
  | "scene"
  | "release"
  | "connected"
  | "vibe";

export type FacetPortalLayout = "featured" | "tall" | "standard";

export type FacetPortalBase = {
  id: FacetId;
  title: string;
  available: boolean;
  emptyMessage: string;
  layout: FacetPortalLayout;
  invitation: string;
  detailHint: string | null;
};

export type ScenePortal = FacetPortalBase & {
  id: "scene";
  chips: string[];
  teaser: string;
  genreCount: number;
  sceneCount: number;
};

export type PeoplePortal = FacetPortalBase & {
  id: "people";
  avatars: Array<{ name: string; initials: string; role?: string }>;
  namePreview: string;
  totalCount: number;
};

export type PlaylistPortal = FacetPortalBase & {
  id: "playlist";
  coverUrls: string[];
  trackCount: number;
  cta: string;
};

export type ReleasePortal = FacetPortalBase & {
  id: "release";
  albumTitle: string;
  label?: string;
  year?: string;
  artworkUrl: string;
  catalogStamp?: string;
};

export type ConnectedPortal = FacetPortalBase & {
  id: "connected";
  previews: Array<{ title: string; artist: string; artworkUrl: string | null }>;
};

export type VibePortal = FacetPortalBase & {
  id: "vibe";
  chips: string[];
  sentence?: string;
};

export type FacetPortal =
  | ScenePortal
  | PeoplePortal
  | PlaylistPortal
  | ReleasePortal
  | ConnectedPortal
  | VibePortal;

function initials(name: string): string {
  const parts = name.trim().split(/\s+/).filter(Boolean);
  if (parts.length >= 2) {
    return `${parts[0]![0] ?? ""}${parts[parts.length - 1]![0] ?? ""}`.toUpperCase();
  }
  return name.slice(0, 2).toUpperCase();
}

function collectPeople(people: PeopleByRole): PersonCredit[] {
  return [
    ...people.producers,
    ...people.writers,
    ...people.performers,
    ...people.remixers,
    ...people.engineers,
  ];
}

function buildScenePortal(
  storyForScene: Pick<MusicStory, "nodes" | "edges" | "rootTrack">,
): ScenePortal {
  const section = groupStoryNodes(storyForScene as MusicStory).find(
    (s) => s.id === "genre-scene",
  );
  const nodes = section?.nodes ?? [];
  const genreCount = nodes.filter((n) => n.type === "genre").length;
  const sceneCount = nodes.filter((n) => n.type === "scene").length;
  const chips = nodes.map((n) => n.title).slice(0, 5);
  const available = chips.length > 0;

  return {
    id: "scene",
    title: "Scene",
    layout: "standard",
    available,
    emptyMessage: "World not fully mapped yet…",
    invitation: "",
    detailHint: null,
    chips,
    genreCount,
    sceneCount,
    teaser: available
      ? (section?.subtitle ?? "The sound and culture around it")
      : "Genres and scenes around this sound",
  };
}

function buildPeoplePortal(people: PeopleByRole): PeoplePortal {
  const credits = collectPeople(people);
  const unique = credits.filter(
    (p, i, arr) => arr.findIndex((x) => x.name === p.name) === i,
  );
  const avatars = unique.slice(0, 6).map((p) => ({
    name: p.name,
    initials: initials(p.name),
    role: p.role,
  }));
  const namePreview = unique
    .slice(0, 2)
    .map((p) => p.name)
    .join(", ");
  const available = unique.length > 0;

  return {
    id: "people",
    title: "People",
    layout: "standard",
    available,
    emptyMessage: "Still discovering…",
    invitation: "",
    detailHint: null,
    avatars,
    totalCount: unique.length,
    namePreview: available
      ? unique.length > 2
        ? `${namePreview} and more`
        : namePreview
      : "Credits and collaborators behind the recording",
  };
}

function buildPlaylistPortal(
  playlist?: PlaylistCandidate,
  discovery?: RabbitHoleDiscoveryState,
): PlaylistPortal {
  const tracks = playlist?.tracks ?? [];
  const coverUrls = tracks
    .map((t) => t.artworkUrl)
    .filter((url): url is string => Boolean(url))
    .slice(0, 4);
  const trackCount =
    tracks.length || discovery?.realCandidateCount || 0;
  const available =
    trackCount > 0 ||
    Boolean(
      discovery &&
        (discovery.status === "rate_limited" ||
          discovery.status === "unavailable" ||
          discovery.status === "warming_up"),
    );

  return {
    id: "playlist",
    title: "Playlist",
    layout: "standard",
    available,
    emptyMessage: "Still discovering…",
    invitation: "",
    detailHint: null,
    coverUrls,
    trackCount,
    cta: "Build a playlist from this world",
  };
}

function buildReleasePortal(
  releaseWorld: ReleaseWorld | null,
  rootTrack: Track,
): ReleasePortal {
  const albumTitle = releaseWorld?.albumTitle ?? rootTrack.albumTitle;
  const year =
    releaseWorld?.releaseYear && releaseWorld.releaseYear > 0
      ? String(releaseWorld.releaseYear)
      : rootTrack.releaseYear > 0
        ? String(rootTrack.releaseYear)
        : undefined;

  return {
    id: "release",
    title: "Release",
    layout: "standard",
    available: Boolean(albumTitle),
    emptyMessage: "Still discovering…",
    invitation: "",
    detailHint: null,
    albumTitle,
    label: releaseWorld?.label,
    year,
    artworkUrl: rootTrack.artworkUrl,
    catalogStamp: releaseWorld?.catalogNumber ?? releaseWorld?.format,
  };
}

function buildConnectedPortal(
  connectedTracks: ConnectedSpotifyTrack[],
): ConnectedPortal {
  const available = connectedTracks.length > 0;

  return {
    id: "connected",
    title: "Connected",
    layout: "standard",
    available,
    emptyMessage: "Connections are still emerging",
    invitation: "",
    detailHint: null,
    previews: connectedTracks.slice(0, 4).map((t) => ({
      title: t.title,
      artist: t.artist,
      artworkUrl: t.artworkUrl,
    })),
  };
}

function buildVibePortal(vibeSignature: VibeSignature | null): VibePortal {
  const chips = vibeSignature?.labels.slice(0, 4) ?? [];

  return {
    id: "vibe",
    title: "Vibe",
    layout: "standard",
    available: Boolean(vibeSignature),
    emptyMessage: "Still discovering…",
    invitation: "",
    detailHint: null,
    chips,
    sentence: vibeSignature?.sentence,
  };
}

function enrichPortalMeta(portal: FacetPortal): FacetPortal {
  return {
    ...portal,
    invitation: buildFacetInvitation(portal, portal.layout),
    detailHint: facetDetailHint(portal),
  };
}

function buildFacetPortalsDraft(input: {
  rootTrack: Track;
  people: PeopleByRole;
  releaseWorld: ReleaseWorld | null;
  connectedTracks: ConnectedSpotifyTrack[];
  playlist?: PlaylistCandidate;
  discovery?: RabbitHoleDiscoveryState;
  vibeSignature: VibeSignature | null;
  storyForScene: Pick<MusicStory, "nodes" | "edges" | "rootTrack">;
}): FacetPortal[] {
  return [
    buildScenePortal(input.storyForScene),
    buildPeoplePortal(input.people),
    buildPlaylistPortal(input.playlist, input.discovery),
    buildReleasePortal(input.releaseWorld, input.rootTrack),
    buildConnectedPortal(input.connectedTracks),
    buildVibePortal(input.vibeSignature),
  ];
}

export function buildFacetPortalsWithHierarchy(
  input: Parameters<typeof buildFacetPortalsDraft>[0],
): {
  portals: FacetPortal[];
  breakdowns: FacetRichnessBreakdown[];
  featuredId: FacetId;
  featuredReason: string;
  worldDescription: string;
} {
  const { portals, breakdowns, featuredId, featuredReason } = assignFacetLayouts(
    buildFacetPortalsDraft(input),
  );

  return {
    portals: portals.map(enrichPortalMeta),
    breakdowns,
    featuredId,
    featuredReason,
    worldDescription: buildWorldDescription({
      rootTrack: input.rootTrack,
      vibeSignature: input.vibeSignature,
      storyForScene: input.storyForScene,
      playlist: input.playlist,
    }),
  };
}

export function buildFacetPortals(
  input: Parameters<typeof buildFacetPortalsDraft>[0],
): FacetPortal[] {
  return buildFacetPortalsWithHierarchy(input).portals;
}

export function releaseFacetUsesRichCard(
  releaseWorld: ReleaseWorld | null,
): boolean {
  return releaseWorldIsRich(releaseWorld);
}
