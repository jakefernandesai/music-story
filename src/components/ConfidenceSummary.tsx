import type { DataSourceConfidence } from "@/lib/types";

type ConfidenceSummaryProps = {
  items: DataSourceConfidence[];
};

const sourceLabels: Record<DataSourceConfidence["source"], string> = {
  spotify: "Spotify",
  musicbrainz: "MusicBrainz",
  inferred: "Inferred",
};

function confidenceColor(value: number): string {
  if (value >= 0.9) return "bg-emerald-500/80";
  if (value >= 0.75) return "bg-accent";
  return "bg-amber-500/70";
}

export function ConfidenceSummary({ items }: ConfidenceSummaryProps) {
  const overall =
    items.reduce((sum, item) => sum + item.confidence, 0) / items.length;

  return (
    <section className="rounded-3xl border border-border bg-surface p-5">
      <div className="flex items-center justify-between gap-4">
        <div>
          <p className="text-[10px] font-medium uppercase tracking-[0.22em] text-accent">
            Source confidence
          </p>
          <h2 className="mt-1.5 font-display text-xl font-medium">
            {Math.round(overall * 100)}% match quality
          </h2>
        </div>
        <div
          className="flex h-11 w-11 shrink-0 items-center justify-center rounded-full border border-accent/30 bg-accent-muted"
          aria-hidden
        >
          <span className="text-sm font-medium text-accent">
            {Math.round(overall * 100)}
          </span>
        </div>
      </div>

      <ul className="mt-5 space-y-3">
        {items.map((item) => (
          <li key={item.source}>
            <div className="mb-1.5 flex items-center justify-between gap-2 text-sm">
              <span className="font-medium">{sourceLabels[item.source]}</span>
              <span className="tabular-nums text-muted">
                {Math.round(item.confidence * 100)}%
              </span>
            </div>
            <div className="h-1 overflow-hidden rounded-full bg-surface-elevated">
              <div
                className={`h-full rounded-full ${confidenceColor(item.confidence)}`}
                style={{ width: `${item.confidence * 100}%` }}
              />
            </div>
          </li>
        ))}
      </ul>
    </section>
  );
}
