"use client";

import type { VibeDirectionChip } from "@/lib/types";
import { pickPathDirections } from "@/lib/direction-labels";
import { PressableChip } from "@/components/motion";

type PathDirectionProps = {
  availableDirections?: VibeDirectionChip[];
};

export function PathDirection({ availableDirections }: PathDirectionProps) {
  const directions = pickPathDirections(availableDirections, 3);

  if (directions.length === 0) {
    return null;
  }

  return (
    <section className="rounded-2xl border border-border/60 bg-surface/60 px-4 py-3.5">
      <p className="text-[10px] font-medium uppercase tracking-[0.22em] text-muted">
        From this song, your path leans…
      </p>
      <div className="mt-2.5 flex flex-wrap gap-2">
        {directions.map((label) => (
          <PressableChip
            key={label}
            className="rounded-full border border-accent/20 bg-accent/8 px-2.5 py-1 text-[11px] font-medium text-accent/90"
          >
            {label}
          </PressableChip>
        ))}
      </div>
    </section>
  );
}
