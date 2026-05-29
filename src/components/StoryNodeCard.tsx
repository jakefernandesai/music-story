import { ArtworkImage } from "@/components/ArtworkImage";
import { isValidImageUrl } from "@/lib/artwork";
import type { DataSource, StoryNode, StoryNodeType } from "@/lib/types";

type StoryNodeCardProps = {
  node: StoryNode;
  relationshipLabel?: string;
  variant?: "featured" | "default";
};

const nodeTypeLabels: Record<StoryNodeType, string> = {
  track: "Track",
  artist: "Artist",
  album: "Album",
  producer: "Producer",
  songwriter: "Songwriter",
  label: "Label",
  genre: "Genre",
  scene: "Scene",
  sample: "Sample",
  cover: "Cover",
  remix: "Remix",
  collaborator: "Collaborator",
};

const nodeTypeColors: Record<StoryNodeType, string> = {
  track: "border-accent/35 bg-accent-muted/40",
  artist: "border-white/10 bg-surface-elevated",
  album: "border-white/10 bg-surface-elevated",
  producer: "border-amber-500/25 bg-amber-500/8",
  songwriter: "border-amber-500/25 bg-amber-500/8",
  label: "border-sky-500/25 bg-sky-500/8",
  genre: "border-violet-500/25 bg-violet-500/8",
  scene: "border-emerald-500/25 bg-emerald-500/8",
  sample: "border-rose-500/25 bg-rose-500/8",
  cover: "border-rose-500/25 bg-rose-500/8",
  remix: "border-fuchsia-500/25 bg-fuchsia-500/8",
  collaborator: "border-teal-500/25 bg-teal-500/8",
};

const sourceLabels: Record<DataSource, string> = {
  spotify: "Spotify",
  musicbrainz: "MusicBrainz",
  inferred: "Inferred",
};

export function StoryNodeCard({
  node,
  relationshipLabel,
  variant = "default",
}: StoryNodeCardProps) {
  const isFeatured = variant === "featured";

  return (
    <article
      className={`rounded-2xl border p-5 transition-colors ${nodeTypeColors[node.type]} ${
        isFeatured ? "shadow-[0_0_40px_-12px_rgba(201,169,98,0.25)]" : ""
      }`}
    >
      {relationshipLabel && (
        <p className="mb-3 text-[10px] font-medium uppercase tracking-[0.2em] text-muted">
          {relationshipLabel}
        </p>
      )}

      <div className={`flex gap-4 ${isFeatured ? "flex-col sm:flex-row" : ""}`}>
        {isValidImageUrl(node.imageUrl) && (
          <div
            className={`relative shrink-0 overflow-hidden rounded-xl ${
              isFeatured ? "aspect-square w-full sm:h-28 sm:w-28" : "h-16 w-16"
            }`}
          >
            <ArtworkImage
              src={node.imageUrl}
              alt=""
              sizes={isFeatured ? "280px" : "64px"}
            />
          </div>
        )}

        <div className="min-w-0 flex-1">
          <div className="flex flex-wrap items-center gap-2">
            <span className="text-[10px] font-medium uppercase tracking-[0.18em] text-muted">
              {nodeTypeLabels[node.type]}
            </span>
            <span className="text-[10px] text-muted/70">
              {sourceLabels[node.source]} · {Math.round(node.confidence * 100)}%
            </span>
          </div>
          <h3
            className={`mt-1 font-display font-medium leading-snug ${
              isFeatured ? "text-2xl" : "text-lg"
            }`}
          >
            {node.title}
          </h3>
          {node.subtitle && (
            <p className="mt-1 text-sm text-foreground/70">{node.subtitle}</p>
          )}
          {node.description && (
            <p
              className={`mt-3 leading-relaxed text-muted ${
                isFeatured ? "text-base" : "text-sm"
              }`}
            >
              {node.description}
            </p>
          )}
        </div>
      </div>
    </article>
  );
}
