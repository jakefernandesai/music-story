import { NextResponse } from "next/server";
import { exchangeAuthorizationCode, SpotifyAuthError } from "@/lib/spotify-auth";
import {
  clearPkceSession,
  clearReturnTo,
  readPkceSession,
  readReturnTo,
  saveSpotifyTokens,
} from "@/lib/spotify-auth-storage";

export async function GET(request: Request) {
  const url = new URL(request.url);
  const code = url.searchParams.get("code");
  const state = url.searchParams.get("state");
  const error = url.searchParams.get("error");
  const returnTo = (await readReturnTo()) ?? "/";

  if (error) {
    await clearPkceSession();
    await clearReturnTo();
    return NextResponse.redirect(
      `${returnTo}?spotify_auth=denied`,
    );
  }

  if (!code || !state) {
    return NextResponse.json(
      { error: "Missing OAuth code or state.", code: "INVALID_CALLBACK" },
      { status: 400 },
    );
  }

  const pkce = await readPkceSession();
  if (!pkce || pkce.state !== state) {
    await clearPkceSession();
    await clearReturnTo();
    return NextResponse.json(
      { error: "Invalid or expired OAuth session.", code: "INVALID_STATE" },
      { status: 400 },
    );
  }

  try {
    const tokens = await exchangeAuthorizationCode({
      code,
      codeVerifier: pkce.codeVerifier,
    });

    await saveSpotifyTokens(tokens);
    await clearPkceSession();
    await clearReturnTo();

    const redirectUrl = new URL(returnTo, url.origin);
    redirectUrl.searchParams.set("spotify_auth", "success");
    return NextResponse.redirect(redirectUrl.toString());
  } catch (authError) {
    await clearPkceSession();
    await clearReturnTo();

    if (authError instanceof SpotifyAuthError) {
      return NextResponse.json(
        { error: authError.message, code: authError.code },
        { status: authError.status },
      );
    }

    return NextResponse.json(
      { error: "Spotify login callback failed.", code: "CALLBACK_FAILED" },
      { status: 500 },
    );
  }
}
