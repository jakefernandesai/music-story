# Music Story

A mobile-first Next.js app that turns any Spotify track URL into a visual music story — enriched with MusicBrainz context and connected narrative nodes.

## Stack

- **Next.js 16** (App Router)
- **TypeScript**
- **Tailwind CSS v4**

## Getting started

1. Copy environment variables:

```bash
cp .env.example .env.local
```

2. Create a [Spotify Developer app](https://developer.spotify.com/dashboard) and add this redirect URI:

```
http://localhost:3000/api/auth/spotify/callback
```

3. Fill in `.env.local`:

```bash
SPOTIFY_CLIENT_ID=your_client_id
SPOTIFY_CLIENT_SECRET=your_client_secret
NEXT_PUBLIC_APP_URL=http://localhost:3000
```

4. Install and run:

```bash
npm install
npm run dev
```

Open [http://localhost:3000](http://localhost:3000), paste a Spotify track URL, and explore the story graph.

## Environment variables

| Variable | Required | Description |
|----------|----------|-------------|
| `SPOTIFY_CLIENT_ID` | Yes | Spotify app client ID |
| `SPOTIFY_CLIENT_SECRET` | Yes | Spotify app client secret (metadata + token refresh) |
| `NEXT_PUBLIC_APP_URL` | Yes | Base URL for OAuth callback construction |
| `SPOTIFY_REDIRECT_URI` | No | Override callback URL if needed |
| `MUSICBRAINZ_USER_AGENT` | No | Custom User-Agent for MusicBrainz API requests |

## Architecture

Story generation is **server-side only**. The UI never calls Spotify or MusicBrainz over HTTP directly.

```
/story?url=…  →  getStoryForUrl()  →  fetchSpotifyTrack()
                                   →  enrichTrackFromSpotify()
                                   →  buildMusicStory()
```

All logic lives in `src/lib/`. The only API routes in this MVP are for Spotify OAuth and playlist export.

## Current scope

- Live Spotify track metadata via Client Credentials
- MusicBrainz enrichment with conservative matching
- Story graph builder and playlist candidate generation
- Spotify OAuth (PKCE) to export private playlists from selected candidates
- MVP token storage in httpOnly cookies — **not production-ready**

## Project structure

```
src/
  app/           # Pages (home, story) and OAuth/playlist API routes
  components/    # UI components
  lib/           # Story pipeline, Spotify/MusicBrainz clients, types
```
