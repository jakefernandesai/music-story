const SPOTIFY_TRACK_PATTERN =
  /^https?:\/\/(?:open\.)?spotify\.com\/track\/([a-zA-Z0-9]+)(?:\?.*)?$/;

export function parseSpotifyTrackUrl(input: string): string | null {
  const trimmed = input.trim();
  const match = trimmed.match(SPOTIFY_TRACK_PATTERN);
  return match?.[1] ?? null;
}

export function isValidSpotifyTrackUrl(input: string): boolean {
  return parseSpotifyTrackUrl(input) !== null;
}
