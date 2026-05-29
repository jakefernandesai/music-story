import { NextResponse } from "next/server";
import { requireSpotifyAccessToken } from "@/lib/spotify-auth-storage";
import {
  addTracksToSpotifyPlaylist,
  SpotifyUserApiError,
} from "@/lib/spotify-user-api";

type RequestBody = {
  uris?: unknown;
};

type RouteContext = {
  params: Promise<{ playlistId: string }>;
};

export async function POST(request: Request, context: RouteContext) {
  const { playlistId } = await context.params;
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
    !Array.isArray(body.uris) ||
    body.uris.some((uri) => typeof uri !== "string" || !uri.startsWith("spotify:track:"))
  ) {
    return NextResponse.json(
      {
        error: 'Expected "uris" to be an array of Spotify track URIs.',
        code: "INVALID_BODY",
      },
      { status: 400 },
    );
  }

  try {
    const accessToken = await requireSpotifyAccessToken();
    await addTracksToSpotifyPlaylist(accessToken, playlistId, body.uris);

    return NextResponse.json({
      added: body.uris.length,
      playlistId,
      mvpNotice:
        "Tracks added with local MVP auth. Token storage is not production-ready.",
    });
  } catch (error) {
    if (error instanceof Error && error.message === "NOT_AUTHENTICATED") {
      return NextResponse.json(
        { error: "Connect Spotify before adding tracks.", code: "NOT_AUTHENTICATED" },
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
      { error: "Failed to add tracks to playlist.", code: "ADD_TRACKS_FAILED" },
      { status: 500 },
    );
  }
}
