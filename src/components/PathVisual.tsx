"use client";

import { useState } from "react";
import type { PathRoute, Track } from "@/lib/types";
import { ArtworkImage } from "@/components/ArtworkImage";

type PathVisualProps = {
  rootTrack: Track;
  pathCounts?: Record<PathRoute, number>;
};

const ROUTES: Array<{ id: PathRoute; label: string; angle: number }> = [
  { id: "familiar", label: "Familiar", angle: -55 },
  { id: "adjacent", label: "Adjacent", angle: 0 },
  { id: "stranger", label: "Stranger", angle: 55 },
];

export function PathVisual({ rootTrack, pathCounts }: PathVisualProps) {
  const [activeRoute, setActiveRoute] = useState<PathRoute | null>(null);

  return (
    <section className="relative overflow-hidden rounded-2xl border border-border/60 bg-surface/40 px-4 py-5">
      <p className="text-center text-[10px] font-medium uppercase tracking-[0.22em] text-muted">
        Your path
      </p>

      <div className="relative mx-auto mt-4 h-36 max-w-xs">
        {/* Branch lines */}
        {ROUTES.map((route) => {
          const count = pathCounts?.[route.id] ?? 0;
          const isActive = activeRoute === route.id;
          const rad = (route.angle * Math.PI) / 180;
          const endX = 50 + Math.sin(rad) * 38;
          const endY = 50 - Math.cos(rad) * 38;

          return (
            <button
              key={route.id}
              type="button"
              onClick={() =>
                setActiveRoute((current) =>
                  current === route.id ? null : route.id,
                )
              }
              className="absolute inset-0"
              aria-label={`${route.label} path — ${count} tracks`}
            >
              <svg
                className="absolute inset-0 h-full w-full"
                viewBox="0 0 100 100"
                aria-hidden
              >
                <line
                  x1="50"
                  y1="58"
                  x2={endX}
                  y2={endY}
                  stroke={
                    isActive
                      ? "rgba(201, 169, 98, 0.55)"
                      : "rgba(255, 255, 255, 0.08)"
                  }
                  strokeWidth={isActive ? 1.5 : 1}
                />
                {Array.from({ length: Math.min(count, 5) }).map((_, i) => {
                  const t = 0.35 + (i + 1) * 0.12;
                  const dotX = 50 + Math.sin(rad) * 38 * t;
                  const dotY = 58 - Math.cos(rad) * 38 * t;
                  return (
                    <circle
                      key={i}
                      cx={dotX}
                      cy={dotY}
                      r={isActive ? 2.2 : 1.6}
                      fill={
                        isActive
                          ? "rgba(201, 169, 98, 0.85)"
                          : "rgba(201, 169, 98, 0.35)"
                      }
                    />
                  );
                })}
              </svg>
              <span
                className={`absolute text-[9px] font-medium uppercase tracking-wider transition-colors ${
                  isActive ? "text-accent" : "text-muted/70"
                }`}
                style={{
                  left: `${endX}%`,
                  top: `${endY}%`,
                  transform: "translate(-50%, -50%)",
                }}
              >
                {route.label}
              </span>
            </button>
          );
        })}

        {/* Root node */}
        <div className="absolute left-1/2 top-[58%] z-10 -translate-x-1/2 -translate-y-1/2">
          <div className="relative h-12 w-12 overflow-hidden rounded-full border-2 border-accent/40 shadow-[0_0_20px_-4px_rgba(201,169,98,0.45)]">
            <ArtworkImage
              src={rootTrack.artworkUrl}
              alt=""
              sizes="48px"
              className="object-cover"
            />
          </div>
          <p className="mt-1.5 max-w-[5.5rem] truncate text-center text-[9px] text-muted">
            {rootTrack.title}
          </p>
        </div>
      </div>

      {activeRoute && (
        <p className="mt-2 text-center text-[11px] text-muted">
          {ROUTES.find((r) => r.id === activeRoute)?.label} —{" "}
          {pathCounts?.[activeRoute] ?? 0} tracks
          <span className="text-muted/60"> · filtering coming soon</span>
        </p>
      )}
    </section>
  );
}
