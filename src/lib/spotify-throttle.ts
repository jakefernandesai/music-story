import { recordRateLimitEvent } from "./recommendation-metrics";

const MAX_CONCURRENT = 2;
const SPOTIFY_BUDGET_COLD = 15;
const SPOTIFY_BUDGET_WARM = 5;

let running = 0;
const waitQueue: Array<() => void> = [];
let rateLimitUntil = 0;

export type SpotifyBudget = {
  maxCalls: number;
  usedCalls: number;
  exhausted: boolean;
};

export function createSpotifyBudget(warmStart: boolean): SpotifyBudget {
  return {
    maxCalls: warmStart ? SPOTIFY_BUDGET_WARM : SPOTIFY_BUDGET_COLD,
    usedCalls: 0,
    exhausted: false,
  };
}

export function isSpotifyGloballyRateLimited(): boolean {
  return Date.now() < rateLimitUntil;
}

export function getSpotifyRateLimitUntil(): number {
  return rateLimitUntil;
}

export function markSpotifyRateLimited(retryAfterSeconds: number): void {
  recordRateLimitEvent();
  rateLimitUntil = Date.now() + retryAfterSeconds * 1000;
}

export function canUseSpotifyBudget(budget: SpotifyBudget): boolean {
  return !budget.exhausted && budget.usedCalls < budget.maxCalls && !isSpotifyGloballyRateLimited();
}

export function consumeSpotifyBudget(budget: SpotifyBudget): boolean {
  if (!canUseSpotifyBudget(budget)) {
    budget.exhausted = true;
    return false;
  }
  budget.usedCalls += 1;
  if (budget.usedCalls >= budget.maxCalls) {
    budget.exhausted = true;
  }
  return true;
}

async function acquireSlot(): Promise<void> {
  if (running < MAX_CONCURRENT) {
    running += 1;
    return;
  }
  await new Promise<void>((resolve) => {
    waitQueue.push(resolve);
  });
  running += 1;
}

function releaseSlot(): void {
  running = Math.max(0, running - 1);
  const next = waitQueue.shift();
  if (next) next();
}

/** Runs a Spotify API call with global concurrency limit and budget accounting. */
export async function withSpotifyThrottle<T>(
  budget: SpotifyBudget,
  fn: () => Promise<T>,
): Promise<T | null> {
  if (!canUseSpotifyBudget(budget)) return null;

  await acquireSlot();
  try {
    if (!consumeSpotifyBudget(budget)) return null;
    return await fn();
  } finally {
    releaseSlot();
  }
}

/** Test-only reset. */
export function resetSpotifyThrottleState(): void {
  running = 0;
  waitQueue.length = 0;
  rateLimitUntil = 0;
}
