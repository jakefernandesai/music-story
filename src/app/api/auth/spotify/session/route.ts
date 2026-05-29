import { NextResponse } from "next/server";
import {
  clearSpotifyTokens,
  getMvpStorageWarning,
  getValidSpotifyAccessToken,
  isSpotifyAuthenticated,
} from "@/lib/spotify-auth-storage";
import { fetchSpotifyUserProfile } from "@/lib/spotify-user-api";

export async function GET() {
  const loggedIn = await isSpotifyAuthenticated();

  if (!loggedIn) {
    return NextResponse.json({
      loggedIn: false,
      storage: getMvpStorageWarning(),
    });
  }

  try {
    const accessToken = await getValidSpotifyAccessToken();
    if (!accessToken) {
      return NextResponse.json({
        loggedIn: false,
        storage: getMvpStorageWarning(),
      });
    }

    const profile = await fetchSpotifyUserProfile(accessToken);

    return NextResponse.json({
      loggedIn: true,
      displayName: profile.display_name ?? "Spotify user",
      storage: getMvpStorageWarning(),
    });
  } catch {
    return NextResponse.json({
      loggedIn: false,
      storage: getMvpStorageWarning(),
    });
  }
}

export async function DELETE() {
  await clearSpotifyTokens();
  return NextResponse.json({ loggedIn: false });
}
