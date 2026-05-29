/**
 * Single server-side entry point for story generation.
 *
 * Flow: Spotify metadata → MusicBrainz enrichment → story builder.
 * The /story page calls this directly — there is no separate HTTP API for
 * fetching stories in the MVP.
 */
import { enrichTrackFromSpotify } from "./musicbrainz";
import { fetchSpotifyTrack, SpotifyServiceError } from "./spotify";
import { buildMusicStory } from "./storyBuilder";
import type { MusicStory } from "./types";

export class StoryFetchError extends Error {
  constructor(
    message: string,
    public readonly code: string,
    public readonly status: number = 500,
  ) {
    super(message);
    this.name = "StoryFetchError";
  }
}

export async function getStoryForUrl(url: string): Promise<MusicStory> {
  try {
    const spotify = await fetchSpotifyTrack(url);
    const enrichment = await enrichTrackFromSpotify(spotify);
    return await buildMusicStory({ spotify, enrichment });
  } catch (error) {
    if (error instanceof SpotifyServiceError) {
      throw new StoryFetchError(error.message, error.code, error.status);
    }

    throw new StoryFetchError(
      "Failed to build music story.",
      "STORY_ERROR",
      500,
    );
  }
}
