"use client";

import { useEffect } from "react";
import type { FacetRichnessBreakdown } from "@/lib/track-hub-scoring";
import type { FacetId } from "@/lib/track-hub-summaries";

type WorldFocusDebugProps = {
  breakdowns: FacetRichnessBreakdown[];
  featuredId: FacetId;
  featuredReason: string;
  worldDescription: string;
};

export function WorldFocusDebug({
  breakdowns,
  featuredId,
  featuredReason,
  worldDescription,
}: WorldFocusDebugProps) {
  useEffect(() => {
    console.info("[Track Hub] facet richness", {
      featured: featuredId,
      reason: featuredReason,
      scores: breakdowns.map((b) => ({
        id: b.id,
        score: b.score,
        signals: b.signals,
      })),
      worldDescription,
    });
  }, [breakdowns, featuredId, featuredReason, worldDescription]);

  return (
    <div
      className="pointer-events-none fixed bottom-3 right-3 z-20 max-w-[min(100vw-1.5rem,20rem)] rounded-lg border border-border/60 bg-background/92 px-2.5 py-2 shadow-lg backdrop-blur-sm"
      aria-hidden
    >
      <p className="text-[8px] font-medium uppercase tracking-wider text-muted">
        World focus
      </p>
      <p className="mt-1 text-[9px] leading-snug text-foreground/85">
        ★ {featuredId}
      </p>
      <p className="mt-0.5 text-[8px] leading-snug text-muted">{featuredReason}</p>
      <ul className="mt-2 space-y-0.5 border-t border-border/40 pt-1.5">
        {breakdowns.map((b) => (
          <li
            key={b.id}
            className={`flex justify-between gap-2 font-mono text-[8px] ${
              b.id === featuredId ? "text-world-accent" : "text-muted"
            }`}
          >
            <span>{b.id}</span>
            <span>{b.score}</span>
          </li>
        ))}
      </ul>
    </div>
  );
}
