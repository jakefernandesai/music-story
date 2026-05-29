import { createHash, randomBytes } from "crypto";

const AUTHORIZE_URL = "https://accounts.spotify.com/authorize";
const TOKEN_URL = "https://accounts.spotify.com/api/token";

export const SPOTIFY_OAUTH_SCOPES = [
  "playlist-modify-private",
  "playlist-modify-public",
] as const;

export type SpotifyOAuthTokens = {
  accessToken: string;
  refreshToken: string;
  expiresAt: number;
  scope: string;
};

type SpotifyTokenResponse = {
  access_token: string;
  refresh_token?: string;
  expires_in: number;
  scope: string;
  token_type: string;
};

export class SpotifyAuthError extends Error {
  constructor(
    message: string,
    public readonly code: string,
    public readonly status: number = 401,
  ) {
    super(message);
    this.name = "SpotifyAuthError";
  }
}

export function getSpotifyClientId(): string {
  const clientId = process.env.SPOTIFY_CLIENT_ID;
  if (!clientId) {
    throw new SpotifyAuthError(
      "SPOTIFY_CLIENT_ID is not configured.",
      "CONFIG",
      500,
    );
  }
  return clientId;
}

export function getSpotifyClientSecret(): string | undefined {
  return process.env.SPOTIFY_CLIENT_SECRET;
}

/** MVP default — override with SPOTIFY_REDIRECT_URI in production. */
export function getSpotifyRedirectUri(): string {
  if (process.env.SPOTIFY_REDIRECT_URI) {
    return process.env.SPOTIFY_REDIRECT_URI;
  }

  const appUrl = process.env.NEXT_PUBLIC_APP_URL ?? "http://localhost:3000";
  return `${appUrl.replace(/\/$/, "")}/api/auth/spotify/callback`;
}

export function generateCodeVerifier(): string {
  return randomBytes(32).toString("base64url");
}

export function generateCodeChallenge(verifier: string): string {
  return createHash("sha256").update(verifier).digest("base64url");
}

export function generateOAuthState(): string {
  return randomBytes(16).toString("hex");
}

export function buildSpotifyAuthorizeUrl(input: {
  state: string;
  codeChallenge: string;
}): string {
  const params = new URLSearchParams({
    client_id: getSpotifyClientId(),
    response_type: "code",
    redirect_uri: getSpotifyRedirectUri(),
    scope: SPOTIFY_OAUTH_SCOPES.join(" "),
    state: input.state,
    code_challenge_method: "S256",
    code_challenge: input.codeChallenge,
  });

  return `${AUTHORIZE_URL}?${params.toString()}`;
}

async function postTokenRequest(body: URLSearchParams): Promise<SpotifyTokenResponse> {
  const clientId = getSpotifyClientId();
  const clientSecret = getSpotifyClientSecret();

  const headers: Record<string, string> = {
    "Content-Type": "application/x-www-form-urlencoded",
  };

  if (clientSecret) {
    headers.Authorization = `Basic ${Buffer.from(`${clientId}:${clientSecret}`).toString("base64")}`;
  }

  const response = await fetch(TOKEN_URL, {
    method: "POST",
    headers,
    body: body.toString(),
  });

  if (!response.ok) {
    let detail = "Spotify token exchange failed.";
    try {
      const errorBody = (await response.json()) as { error_description?: string };
      if (errorBody.error_description) detail = errorBody.error_description;
    } catch {
      // Ignore malformed error payloads.
    }

    throw new SpotifyAuthError(detail, "TOKEN_EXCHANGE_FAILED", 502);
  }

  return (await response.json()) as SpotifyTokenResponse;
}

export function toStoredTokens(
  response: SpotifyTokenResponse,
  previousRefreshToken?: string,
): SpotifyOAuthTokens {
  return {
    accessToken: response.access_token,
    refreshToken: response.refresh_token ?? previousRefreshToken ?? "",
    expiresAt: Date.now() + response.expires_in * 1000 - 60_000,
    scope: response.scope,
  };
}

export async function exchangeAuthorizationCode(input: {
  code: string;
  codeVerifier: string;
}): Promise<SpotifyOAuthTokens> {
  const body = new URLSearchParams({
    grant_type: "authorization_code",
    code: input.code,
    redirect_uri: getSpotifyRedirectUri(),
    client_id: getSpotifyClientId(),
    code_verifier: input.codeVerifier,
  });

  const response = await postTokenRequest(body);
  return toStoredTokens(response);
}

export async function refreshSpotifyTokens(
  refreshToken: string,
): Promise<SpotifyOAuthTokens> {
  if (!refreshToken) {
    throw new SpotifyAuthError("Missing refresh token.", "NOT_AUTHENTICATED", 401);
  }

  const body = new URLSearchParams({
    grant_type: "refresh_token",
    refresh_token: refreshToken,
    client_id: getSpotifyClientId(),
  });

  const response = await postTokenRequest(body);
  return toStoredTokens(response, refreshToken);
}

export function isAccessTokenValid(tokens: SpotifyOAuthTokens): boolean {
  return Boolean(tokens.accessToken) && Date.now() < tokens.expiresAt;
}
