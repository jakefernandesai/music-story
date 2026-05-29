export type RecommendationMetrics = {
  playlistCacheHit: boolean;
  lastfmCalls: number;
  lastfmCacheHits: number;
  spotifyCalls: number;
  spotifyCacheHits: number;
  candidatesBeforeSpotify: number;
  resolvedSpotifyUris: number;
  rateLimitEvents: number;
  servedFromCache: boolean;
  partialDueToRateLimit: boolean;
};

export function createRecommendationMetrics(): RecommendationMetrics {
  return {
    playlistCacheHit: false,
    lastfmCalls: 0,
    lastfmCacheHits: 0,
    spotifyCalls: 0,
    spotifyCacheHits: 0,
    candidatesBeforeSpotify: 0,
    resolvedSpotifyUris: 0,
    rateLimitEvents: 0,
    servedFromCache: false,
    partialDueToRateLimit: false,
  };
}

let activeMetrics: RecommendationMetrics | null = null;

export function beginRecommendationMetrics(): RecommendationMetrics {
  activeMetrics = createRecommendationMetrics();
  return activeMetrics;
}

export function getActiveRecommendationMetrics(): RecommendationMetrics | null {
  return activeMetrics;
}

export function endRecommendationMetrics(): RecommendationMetrics | null {
  const metrics = activeMetrics;
  activeMetrics = null;
  return metrics;
}

export function recordLastfmCall(fromCache: boolean): void {
  if (!activeMetrics) return;
  if (fromCache) activeMetrics.lastfmCacheHits += 1;
  else activeMetrics.lastfmCalls += 1;
}

export function recordSpotifyCall(fromCache: boolean): void {
  if (!activeMetrics) return;
  if (fromCache) activeMetrics.spotifyCacheHits += 1;
  else activeMetrics.spotifyCalls += 1;
}

export function recordRateLimitEvent(): void {
  if (!activeMetrics) return;
  activeMetrics.rateLimitEvents += 1;
  activeMetrics.partialDueToRateLimit = true;
}

export function logRecommendationMetrics(
  label: string,
  metrics: RecommendationMetrics,
): void {
  const lastfmTotal = metrics.lastfmCalls + metrics.lastfmCacheHits;
  const spotifyTotal = metrics.spotifyCalls + metrics.spotifyCacheHits;
  const lastfmHitRate =
    lastfmTotal > 0 ? ((metrics.lastfmCacheHits / lastfmTotal) * 100).toFixed(1) : "n/a";
  const spotifyHitRate =
    spotifyTotal > 0 ? ((metrics.spotifyCacheHits / spotifyTotal) * 100).toFixed(1) : "n/a";

  console.log(`[rec-metrics] ${label}`, {
    playlistCacheHit: metrics.playlistCacheHit,
    servedFromCache: metrics.servedFromCache,
    lastfmCalls: metrics.lastfmCalls,
    lastfmCacheHitRate: `${lastfmHitRate}%`,
    spotifyCalls: metrics.spotifyCalls,
    spotifyCacheHitRate: `${spotifyHitRate}%`,
    candidatesBeforeSpotify: metrics.candidatesBeforeSpotify,
    resolvedSpotifyUris: metrics.resolvedSpotifyUris,
    rateLimitEvents: metrics.rateLimitEvents,
    partialDueToRateLimit: metrics.partialDueToRateLimit,
  });
}
