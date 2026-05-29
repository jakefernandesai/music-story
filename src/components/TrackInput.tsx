"use client";

import { useState, FormEvent } from "react";
import { useRouter } from "next/navigation";
import { isValidSpotifyTrackUrl } from "@/lib/spotify-url";

export function TrackInput() {
  const router = useRouter();
  const [url, setUrl] = useState("");
  const [error, setError] = useState("");

  function handleSubmit(e: FormEvent) {
    e.preventDefault();
    setError("");

    if (!url.trim()) {
      setError("Paste a Spotify track link to begin.");
      return;
    }

    if (!isValidSpotifyTrackUrl(url)) {
      setError("That doesn't look like a Spotify track URL.");
      return;
    }

    router.push(`/story?url=${encodeURIComponent(url.trim())}`);
  }

  return (
    <form onSubmit={handleSubmit} className="w-full space-y-4">
      <label htmlFor="spotify-url" className="sr-only">
        Spotify track URL
      </label>
      <div className="relative">
        <input
          id="spotify-url"
          type="url"
          value={url}
          onChange={(e) => {
            setUrl(e.target.value);
            if (error) setError("");
          }}
          placeholder="https://open.spotify.com/track/..."
          className="w-full rounded-2xl border border-border bg-surface px-5 py-4 text-base text-foreground placeholder:text-muted/60 outline-none transition-colors focus:border-accent/40 focus:ring-2 focus:ring-accent/20"
          autoComplete="off"
          spellCheck={false}
        />
      </div>

      {error && (
        <p className="text-sm text-red-400/90" role="alert">
          {error}
        </p>
      )}

      <button
        type="submit"
        className="w-full rounded-2xl bg-accent px-6 py-4 text-base font-medium text-background transition-all hover:bg-accent/90 active:scale-[0.99]"
      >
        Generate music story
      </button>

      <p className="text-center text-xs text-muted/70">
        Fetches live metadata from Spotify and MusicBrainz.
      </p>
    </form>
  );
}
