import Link from "next/link";
import { Suspense } from "react";
import { redirect } from "next/navigation";
import { TrackHub } from "@/components/story/TrackHub";
import { StoryFetchError } from "@/components/StoryFetchError";
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

  return (
    <div className="flex flex-col gap-6 pb-8">
      <nav className="sticky top-0 z-30 -mx-5 border-b border-border/30 bg-background/80 px-5 py-3 backdrop-blur-md sm:static sm:mx-0 sm:border-0 sm:bg-transparent sm:px-0 sm:py-0">
        <Link
          href="/"
          className="inline-flex items-center gap-2 text-sm text-muted transition-colors hover:text-foreground"
        >
          <span aria-hidden>←</span>
          New track
        </Link>
      </nav>

      <Suspense fallback={null}>
        <TrackHub
          rootTrack={story.rootTrack}
          people={story.people}
          releaseWorld={story.releaseWorld}
          connectedTracks={story.connectedTracks}
          playlist={story.playlistCandidates[0]}
          discovery={story.rabbitHoleDiscovery}
          vibeSignature={story.vibeSignature}
          nodes={story.nodes}
          edges={story.edges}
          showDebug={showDebug}
          fixtureMode={fixtureMode}
        />
      </Suspense>
    </div>
  );
}
