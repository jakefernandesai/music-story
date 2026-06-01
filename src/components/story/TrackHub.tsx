"use client";

import { useMemo, useState } from "react";
import type {
  ConnectedSpotifyTrack,
  MusicStory,
  PeopleByRole,
  PlaylistCandidate,
  RabbitHoleDiscoveryState,
  ReleaseWorld,
  Track,
  VibeSignature,
} from "@/lib/types";
import {
  buildFacetPortalsWithHierarchy,
  releaseFacetUsesRichCard,
  type FacetId,
  type FacetPortal,
} from "@/lib/track-hub-summaries";
import { WorldFocusDebug } from "@/components/story/WorldFocusDebug";
import { FadeIn, StaggerGroup } from "@/components/motion";
import { PreviewProvider } from "@/components/preview/PreviewProvider";
import { VibeSignatureCard } from "@/components/VibeSignatureCard";
import { YouMightAlsoLike } from "@/components/story/YouMightAlsoLike";
import { PeopleBehind } from "@/components/story/PeopleBehind";
import { ReleaseWorldCard } from "@/components/story/ReleaseWorldCard";
import { ConnectedTracks } from "@/components/story/ConnectedTracks";
import { GenreScenePanel } from "@/components/story/GenreScenePanel";
import { FacetSheet } from "@/components/story/FacetSheet";
import { TrackHubHero } from "@/components/story/TrackHubHero";
import { TrackFeature } from "@/components/story/TrackFeature";
import { FacetPortalCard } from "@/components/story/FacetPortalCard";
import { WorldThemeProvider } from "@/components/story/WorldThemeProvider";
import { countPeople } from "@/lib/story-context-utils";

const FACET_SUBTITLES: Record<FacetId, string> = {
  playlist: "Pick tracks and save a playlist from this world",
  people: "Performers, producers, and collaborators",
  scene: "Genres and the culture around this sound",
  release: "Album, label, and how it reached the world",
  connected: "Remixes, covers, and versions on Spotify",
  vibe: "Taste profile around this artist",
};

type TrackHubProps = {
  rootTrack: Track;
  people: PeopleByRole;
  releaseWorld: ReleaseWorld | null;
  connectedTracks: ConnectedSpotifyTrack[];
  playlist?: PlaylistCandidate;
  discovery?: RabbitHoleDiscoveryState;
  vibeSignature: VibeSignature | null;
  nodes: MusicStory["nodes"];
  edges: MusicStory["edges"];
  showDebug?: boolean;
  fixtureMode?: boolean;
};

export function TrackHub({
  rootTrack,
  people,
  releaseWorld,
  connectedTracks,
  playlist,
  discovery,
  vibeSignature,
  nodes,
  edges,
  showDebug = false,
  fixtureMode = false,
}: TrackHubProps) {
  const [activeFacet, setActiveFacet] = useState<FacetId | null>(null);

  const hub = useMemo(
    () =>
      buildFacetPortalsWithHierarchy({
        rootTrack,
        people,
        releaseWorld,
        connectedTracks,
        playlist,
        discovery,
        vibeSignature,
        storyForScene: { nodes, edges, rootTrack },
      }),
    [
      rootTrack,
      people,
      releaseWorld,
      connectedTracks,
      playlist,
      discovery,
      vibeSignature,
      nodes,
      edges,
    ],
  );

  const { portals, featuredId, featuredReason, worldDescription, breakdowns } =
    hub;

  const activePortal = portals.find((p) => p.id === activeFacet);

  return (
    <WorldThemeProvider
      key={rootTrack.spotifyId ?? rootTrack.id}
      artworkUrl={rootTrack.artworkUrl}
      seed={rootTrack.spotifyId ?? rootTrack.id}
      showDebug={showDebug}
    >
      <PreviewProvider>
      <div className="flex flex-col gap-8 pb-10">
        <TrackHubHero track={rootTrack} worldDescription={worldDescription} />

        <section aria-label="Explore around this song">
          <FadeIn delay={0.1}>
            <h2 className="font-display text-xl font-medium tracking-tight">
              Explore around this song
            </h2>
            <p className="mt-1.5 text-sm text-muted">
              Start with{" "}
              <span className="text-foreground/80">{featuredId}</span> — then
              follow any door.
            </p>
          </FadeIn>

          <StaggerGroup
            className="mt-5 grid grid-cols-2 gap-3"
            delayChildren={0.06}
          >
            {portals.map((portal: FacetPortal) => (
              <FacetPortalCard
                key={portal.id}
                portal={portal}
                onOpen={() => setActiveFacet(portal.id)}
              />
            ))}
          </StaggerGroup>
        </section>
      </div>

      <FacetSheet
        open={activeFacet !== null}
        title={activePortal?.title ?? ""}
        subtitle={activeFacet ? FACET_SUBTITLES[activeFacet] : undefined}
        onClose={() => setActiveFacet(null)}
      >
        {activeFacet === "playlist" &&
          (playlist ||
          (discovery &&
            discovery.status !== "ready" &&
            discovery.status !== "cached") ? (
            <YouMightAlsoLike
              rootTrack={rootTrack}
              playlist={playlist}
              discovery={discovery}
              showDebug={showDebug}
              fixtureMode={fixtureMode}
              showHero={false}
            />
          ) : (
            <p className="text-sm leading-relaxed text-muted">
              Recommendations aren&apos;t available for this track right now. Try
              fixture mode or check back when Spotify limits clear.
            </p>
          ))}

        {activeFacet === "people" &&
          (countPeople(people) > 0 ? (
            <PeopleBehind people={people} />
          ) : (
            <p className="text-sm leading-relaxed text-muted">
              No MusicBrainz credits surfaced for this recording yet.
            </p>
          ))}

        {activeFacet === "scene" && (
          <GenreScenePanel nodes={nodes} edges={edges} rootTrack={rootTrack} />
        )}

        {activeFacet === "release" && (
          <>
            {releaseFacetUsesRichCard(releaseWorld) && releaseWorld ? (
              <ReleaseWorldCard release={releaseWorld} />
            ) : (
              <TrackFeature
                track={rootTrack}
                releaseWorld={releaseWorld}
                variant="compact"
              />
            )}
          </>
        )}

        {activeFacet === "connected" &&
          (connectedTracks.length > 0 ? (
            <ConnectedTracks tracks={connectedTracks} />
          ) : (
            <p className="text-sm leading-relaxed text-muted">
              No connected remixes, covers, or versions found on Spotify for
              this track yet.
            </p>
          ))}

        {activeFacet === "vibe" && (
          <VibeSignatureCard vibeSignature={vibeSignature} />
        )}
      </FacetSheet>
      {showDebug && (
        <WorldFocusDebug
          breakdowns={breakdowns}
          featuredId={featuredId}
          featuredReason={featuredReason}
          worldDescription={worldDescription}
        />
      )}
      </PreviewProvider>
    </WorldThemeProvider>
  );
}
