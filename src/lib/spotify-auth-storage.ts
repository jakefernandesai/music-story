/**
 * MVP-only Spotify OAuth token storage.
 *
 * NOT PRODUCTION READY:
 * - Refresh tokens live in a plain httpOnly cookie on this device/browser.
 * - No encryption at rest, no server-side session store, no token rotation audit trail.
 * - Suitable for local development demos only.
 */
import { cookies } from "next/headers";
import {
  isAccessTokenValid,
  refreshSpotifyTokens,
  type SpotifyOAuthTokens,
} from "./spotify-auth";

const TOKEN_COOKIE = "music_story_spotify_tokens";
const PKCE_COOKIE = "music_story_spotify_pkce";
const RETURN_TO_COOKIE = "music_story_spotify_return_to";

const THIRTY_DAYS = 60 * 60 * 24 * 30;
const TEN_MINUTES = 60 * 10;

type PkceSession = {
  state: string;
  codeVerifier: string;
};

function cookieOptions(maxAge: number) {
  return {
    httpOnly: true,
    sameSite: "lax" as const,
    secure: process.env.NODE_ENV === "production",
    path: "/",
    maxAge,
  };
}

export async function savePkceSession(session: PkceSession): Promise<void> {
  const jar = await cookies();
  jar.set(PKCE_COOKIE, JSON.stringify(session), cookieOptions(TEN_MINUTES));
}

export async function readPkceSession(): Promise<PkceSession | null> {
  const jar = await cookies();
  const raw = jar.get(PKCE_COOKIE)?.value;
  if (!raw) return null;

  try {
    return JSON.parse(raw) as PkceSession;
  } catch {
    return null;
  }
}

export async function clearPkceSession(): Promise<void> {
  const jar = await cookies();
  jar.delete(PKCE_COOKIE);
}

export async function saveReturnTo(path: string): Promise<void> {
  const jar = await cookies();
  jar.set(RETURN_TO_COOKIE, path, cookieOptions(TEN_MINUTES));
}

export async function readReturnTo(): Promise<string | null> {
  const jar = await cookies();
  return jar.get(RETURN_TO_COOKIE)?.value ?? null;
}

export async function clearReturnTo(): Promise<void> {
  const jar = await cookies();
  jar.delete(RETURN_TO_COOKIE);
}

export async function saveSpotifyTokens(tokens: SpotifyOAuthTokens): Promise<void> {
  const jar = await cookies();
  jar.set(TOKEN_COOKIE, JSON.stringify(tokens), cookieOptions(THIRTY_DAYS));
}

export async function readSpotifyTokens(): Promise<SpotifyOAuthTokens | null> {
  const jar = await cookies();
  const raw = jar.get(TOKEN_COOKIE)?.value;
  if (!raw) return null;

  try {
    return JSON.parse(raw) as SpotifyOAuthTokens;
  } catch {
    return null;
  }
}

export async function clearSpotifyTokens(): Promise<void> {
  const jar = await cookies();
  jar.delete(TOKEN_COOKIE);
}

export async function getValidSpotifyAccessToken(): Promise<string | null> {
  const tokens = await readSpotifyTokens();
  if (!tokens) return null;

  if (isAccessTokenValid(tokens)) {
    return tokens.accessToken;
  }

  if (!tokens.refreshToken) {
    await clearSpotifyTokens();
    return null;
  }

  try {
    const refreshed = await refreshSpotifyTokens(tokens.refreshToken);
    await saveSpotifyTokens(refreshed);
    return refreshed.accessToken;
  } catch {
    await clearSpotifyTokens();
    return null;
  }
}

export async function requireSpotifyAccessToken(): Promise<string> {
  const accessToken = await getValidSpotifyAccessToken();
  if (!accessToken) {
    throw new Error("NOT_AUTHENTICATED");
  }
  return accessToken;
}

export async function isSpotifyAuthenticated(): Promise<boolean> {
  const token = await getValidSpotifyAccessToken();
  return Boolean(token);
}

/** Test helper — not for production use. */
export function getMvpStorageWarning(): string {
  return "Tokens are stored in a local httpOnly cookie for MVP demos only.";
}
