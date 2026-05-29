import Link from "next/link";
import { Suspense } from "react";
import { redirect } from "next/navigation";
import { TrackFeature } from "@/components/story/TrackFeature";
import { PeopleBehind } from "@/components/story/PeopleBehind";
import { ReleaseWorldCard } from "@/components/story/ReleaseWorldCard";
import { ConnectedTracks } from "@/components/story/ConnectedTracks";
import { YouMightAlsoLike } from "@/components/story/YouMightAlsoLike";
import { StoryFetchError } from "@/components/StoryFetchError";
import { releaseWorldIsRich } from "@/lib/story-context-utils";
import { getStoryForUrl, StoryFetchError as StoryFetchErrorType } from "@/lib/get-story";

type StoryPageProps = {
  searchParams: Promise<{ url?: string }>;
};

export default async function StoryPage({ searchParams }: StoryPageProps) {
  const { url } = await searchParams;

  if (!url) {
    redirect("/");
  }

  let story;

  try {
    story = await getStoryForUrl(url);
  } catch (error) {
    if (error instanceof StoryFetchErrorType) {
      return (
        <div className="flex flex-col gap-8 pb-16">
          <nav>
            <Link
              href="/"
              className="inline-flex items-center gap-2 text-sm text-muted transition-colors hover:text-foreground"
            >
              <span aria-hidden>←</span>
              New track
            </Link>
          </nav>
          <StoryFetchError message={error.message} code={error.code} />
        </div>
      );
    }

    throw error;
  }

  const showDebug = process.env.NEXT_PUBLIC_DEBUG_RECS === "1";
  const fixtureMode = process.env.NEXT_PUBLIC_USE_RECOMMENDATION_FIXTURES === "true";
  const showReleaseWorld =
    story.releaseWorld && releaseWorldIsRich(story.releaseWorld);

  return (
    <div className="flex flex-col gap-6 pb-8">
      <nav className="sticky top-0 z-40 -mx-5 border-b border-border/30 bg-background/80 px-5 py-3 backdrop-blur-md sm:static sm:mx-0 sm:border-0 sm:bg-transparent sm:px-0 sm:py-0">
        <Link
          href="/"
          className="inline-flex items-center gap-2 text-sm text-muted transition-colors hover:text-foreground"
        >
          <span aria-hidden>←</span>
          New track
        </Link>
      </nav>

      <Suspense fallback={null}>
        <YouMightAlsoLike
          rootTrack={story.rootTrack}
          playlist={story.playlistCandidates[0]}
          discovery={story.rabbitHoleDiscovery}
          showDebug={showDebug}
          fixtureMode={fixtureMode}
        />
      </Suspense>

      <details className="group mt-2 border-t border-border/40 pt-5">
        <summary className="cursor-pointer list-none text-sm font-medium text-muted transition-colors hover:text-foreground [&::-webkit-details-marker]:hidden">
          <span className="flex items-center justify-between gap-2">
            About this track
            <span className="text-xs text-muted/60 transition-transform group-open:rotate-180">
              ▾
            </span>
          </span>
        </summary>
        <div className="mt-5 space-y-8 text-sm [&_h2]:text-lg [&_section]:opacity-95">
          <TrackFeature
            track={story.rootTrack}
            releaseWorld={showReleaseWorld ? null : story.releaseWorld}
            variant="compact"
          />
          <PeopleBehind people={story.people} />
          {showReleaseWorld && story.releaseWorld && (
            <ReleaseWorldCard release={story.releaseWorld} />
          )}
          <ConnectedTracks tracks={story.connectedTracks} />
        </div>
      </details>
    </div>
  );
}
