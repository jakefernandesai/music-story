import { NextResponse } from "next/server";
import { requireSpotifyAccessToken } from "@/lib/spotify-auth-storage";
import {
  createSpotifyPlaylist,
  SpotifyUserApiError,
} from "@/lib/spotify-user-api";

type RequestBody = {
  name?: unknown;
  description?: unknown;
  public?: unknown;
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

  if (typeof body.name !== "string" || body.name.trim().length === 0) {
    return NextResponse.json(
      { error: 'Missing or invalid "name" field.', code: "INVALID_BODY" },
      { status: 400 },
    );
  }

  try {
    const accessToken = await requireSpotifyAccessToken();
    const playlist = await createSpotifyPlaylist(accessToken, {
      name: body.name.trim(),
      description:
        typeof body.description === "string" ? body.description : undefined,
      public: body.public === true ? true : false,
    });

    return NextResponse.json({
      playlist: {
        id: playlist.id,
        name: playlist.name,
        url: playlist.external_urls.spotify,
        public: body.public === true,
      },
      mvpNotice:
        "Playlist created with local MVP auth. Token storage is not production-ready.",
    });
  } catch (error) {
    if (error instanceof Error && error.message === "NOT_AUTHENTICATED") {
      return NextResponse.json(
        { error: "Connect Spotify before creating playlists.", code: "NOT_AUTHENTICATED" },
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
      { error: "Failed to create playlist.", code: "CREATE_FAILED" },
      { status: 500 },
    );
  }
}
