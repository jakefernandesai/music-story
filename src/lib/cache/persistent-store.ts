import { createHash } from "crypto";
import { mkdir, readFile, unlink, writeFile } from "fs/promises";
import { join } from "path";
import type { CacheNamespace } from "./ttl";
import { CACHE_TTL_MS } from "./ttl";

const CACHE_ROOT =
  process.env.CACHE_DIR ??
  join(/* turbopackIgnore: true */ process.cwd(), "data", "cache");

type CacheEntry<T> = {
  value: T;
  expiresAt: number;
};

const memoryLayer = new Map<string, CacheEntry<unknown>>();

function memoryKey(namespace: string, key: string): string {
  return `${namespace}:${key}`;
}

function filePath(namespace: string, key: string): string {
  const hash = createHash("sha256").update(key).digest("hex");
  return join(CACHE_ROOT, namespace, `${hash}.json`);
}

function normaliseKey(key: string): string {
  return key.toLowerCase().trim();
}

export async function cacheGet<T>(namespace: CacheNamespace, key: string): Promise<T | null> {
  const cacheKey = normaliseKey(key);
  const mem = memoryLayer.get(memoryKey(namespace, cacheKey));
  if (mem && Date.now() <= mem.expiresAt) {
    return mem.value as T;
  }

  try {
    const raw = await readFile(filePath(namespace, cacheKey), "utf8");
    const entry = JSON.parse(raw) as CacheEntry<T>;
    if (Date.now() > entry.expiresAt) {
      await unlink(filePath(namespace, cacheKey)).catch(() => undefined);
      return null;
    }
    memoryLayer.set(memoryKey(namespace, cacheKey), entry as CacheEntry<unknown>);
    return entry.value;
  } catch {
    return null;
  }
}

export async function cacheSet<T>(
  namespace: CacheNamespace,
  key: string,
  value: T,
  ttlMs: number = CACHE_TTL_MS[namespace],
): Promise<void> {
  const cacheKey = normaliseKey(key);
  const entry: CacheEntry<T> = { value, expiresAt: Date.now() + ttlMs };
  memoryLayer.set(memoryKey(namespace, cacheKey), entry as CacheEntry<unknown>);

  const dir = join(CACHE_ROOT, namespace);
  await mkdir(dir, { recursive: true });
  await writeFile(filePath(namespace, cacheKey), JSON.stringify(entry), "utf8");
}

export async function cacheDelete(namespace: CacheNamespace, key: string): Promise<void> {
  const cacheKey = normaliseKey(key);
  memoryLayer.delete(memoryKey(namespace, cacheKey));
  await unlink(filePath(namespace, cacheKey)).catch(() => undefined);
}

/** Clears in-memory layer only — disk cache survives for cross-process reuse. */
export function clearMemoryCache(): void {
  memoryLayer.clear();
}
