import type { ReleaseWorld } from "@/lib/types";
import { FadeIn } from "@/components/motion";

type ReleaseWorldCardProps = {
  release: ReleaseWorld;
};

export function ReleaseWorldCard({ release }: ReleaseWorldCardProps) {
  const stamps = [
    release.label && { label: "Label", value: release.label },
    release.catalogNumber && { label: "Cat.", value: release.catalogNumber },
    release.releaseDate && { label: "Released", value: release.releaseDate },
    !release.releaseDate &&
      release.releaseYear > 0 && {
        label: "Year",
        value: String(release.releaseYear),
      },
    release.country && { label: "Country", value: release.country },
    release.format && { label: "Format", value: release.format },
  ].filter(Boolean) as Array<{ label: string; value: string }>;

  return (
    <FadeIn>
      <section
        aria-label="Release world"
        className="relative overflow-hidden rounded-2xl border border-border bg-surface px-4 py-4"
      >
        <div
          className="pointer-events-none absolute -right-6 -top-6 h-24 w-24 rotate-12 rounded border border-accent/20 bg-accent/5"
          aria-hidden
        />
        <p className="text-[10px] font-medium uppercase tracking-[0.22em] text-accent">
          Release world
        </p>
        <h2 className="mt-1 font-display text-lg font-medium leading-snug">
          {release.albumTitle}
        </h2>

        <div className="mt-3 flex flex-wrap gap-2">
          {stamps.map((stamp) => (
            <div
              key={stamp.label}
              className="rounded-md border border-dashed border-border/80 bg-surface-elevated/40 px-2.5 py-1.5"
            >
              <p className="text-[9px] uppercase tracking-wider text-muted">
                {stamp.label}
              </p>
              <p className="text-xs font-medium">{stamp.value}</p>
            </div>
          ))}
        </div>
      </section>
    </FadeIn>
  );
}
