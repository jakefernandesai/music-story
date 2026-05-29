import type { Track } from "./types";

export function formatDuration(ms: number): string {
  const totalSeconds = Math.floor(ms / 1000);
  const minutes = Math.floor(totalSeconds / 60);
  const seconds = totalSeconds % 60;
  return `${minutes}:${seconds.toString().padStart(2, "0")}`;
}

export function formatArtists(track: Track): string {
  return track.artists.map((artist) => artist.name).join(", ");
}

export function primaryArtist(track: Track): string {
  return track.artists[0]?.name ?? "Unknown artist";
}
