import { NextResponse } from "next/server";
import { requireSpotifyAccessToken } from "@/lib/spotify-auth-storage";
import {
  resolveStoryTracksToUris,
  SpotifyUserApiError,
} from "@/lib/spotify-user-api";

type RequestBody = {
  tracks?: unknown;
};

export async function POST(request: Request) {
  let body: RequestBody;

  try {
    body = (await request.json()) as RequestBody;
  } catch {
    return NextResponse.json(
      { error: "Request body must be valid JSON.", code: "INVALID_JSON" },
      { status: 400 },
    );
  }

  if (
    !Array.isArray(body.tracks) ||
    body.tracks.some(
      (track) =>
        !track ||
        typeof track !== "object" ||
        typeof (track as { title?: unknown }).title !== "string" ||
        typeof (track as { artist?: unknown }).artist !== "string",
    )
  ) {
    return NextResponse.json(
      {
        error: 'Expected "tracks" to be an array of { title, artist } objects.',
        code: "INVALID_BODY",
      },
      { status: 400 },
    );
  }

  try {
    const accessToken = await requireSpotifyAccessToken();
    const tracks = body.tracks as Array<{
      title: string;
      artist: string;
      uri?: string;
    }>;

    const resolved = await resolveStoryTracksToUris(accessToken, tracks);
    const uris = resolved
      .map((track) => track.uri)
      .filter((uri): uri is string => Boolean(uri));

    return NextResponse.json({
      resolved,
      uris,
      matchedCount: resolved.filter((track) => track.matched).length,
      totalCount: resolved.length,
      mvpNotice:
        "Track resolution uses Spotify search and may miss obscure recordings.",
    });
  } catch (error) {
    if (error instanceof Error && error.message === "NOT_AUTHENTICATED") {
      return NextResponse.json(
        { error: "Connect Spotify before resolving tracks.", code: "NOT_AUTHENTICATED" },
        { status: 401 },
      );
    }

    if (error instanceof SpotifyUserApiError) {
      return NextResponse.json(
        { error: error.message, code: "SPOTIFY_API_ERROR" },
        { status: error.status },
      );
    }

    return NextResponse.json(
      { error: "Failed to resolve tracks.", code: "RESOLVE_FAILED" },
      { status: 500 },
    );
  }
}
