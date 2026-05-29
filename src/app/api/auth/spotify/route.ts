import { NextResponse } from "next/server";
import {
  buildSpotifyAuthorizeUrl,
  generateCodeChallenge,
  generateCodeVerifier,
  generateOAuthState,
  SpotifyAuthError,
} from "@/lib/spotify-auth";
import {
  savePkceSession,
  saveReturnTo,
} from "@/lib/spotify-auth-storage";

export async function GET(request: Request) {
  try {
    const url = new URL(request.url);
    const returnTo = url.searchParams.get("returnTo") ?? "/";

    if (!returnTo.startsWith("/")) {
      return NextResponse.json(
        { error: "returnTo must be a relative path.", code: "INVALID_RETURN_TO" },
        { status: 400 },
      );
    }

    const codeVerifier = generateCodeVerifier();
    const state = generateOAuthState();

    await savePkceSession({ state, codeVerifier });
    await saveReturnTo(returnTo);

    const authorizeUrl = buildSpotifyAuthorizeUrl({
      state,
      codeChallenge: generateCodeChallenge(codeVerifier),
    });

    return NextResponse.redirect(authorizeUrl);
  } catch (error) {
    if (error instanceof SpotifyAuthError) {
      return NextResponse.json(
        { error: error.message, code: error.code },
        { status: error.status },
      );
    }

    return NextResponse.json(
      { error: "Failed to start Spotify login.", code: "AUTH_START_FAILED" },
      { status: 500 },
    );
  }
}
