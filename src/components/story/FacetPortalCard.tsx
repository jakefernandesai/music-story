"use client";

import type { ReactNode } from "react";
import { ArtworkImage } from "@/components/ArtworkImage";
import { PressableCard } from "@/components/motion/PressableCard";
import { StaggerItem } from "@/components/motion";
import type { FacetPortal, FacetPortalLayout } from "@/lib/track-hub-summaries";

const LAYOUT_CLASS: Record<FacetPortalLayout, string> = {
  featured: "col-span-2 min-h-[13.5rem]",
  tall: "min-h-[9.5rem]",
  standard: "min-h-[8.25rem]",
};

function PortalInvitation({
  portal,
}: {
  portal: FacetPortal;
}) {
  const featured = portal.layout === "featured";

  return (
    <div className="mt-2">
      <p
        className={`leading-snug text-foreground/95 ${
          featured
            ? "font-display text-xl font-medium"
            : "text-sm font-medium"
        }`}
      >
        {portal.available ? portal.invitation : portal.emptyMessage}
      </p>
      {portal.available && portal.detailHint && (
        <p className="mt-1 text-[10px] text-muted/80">{portal.detailHint}</p>
      )}
    </div>
  );
}

function PortalShell({
  portal,
  onOpen,
  children,
}: {
  portal: FacetPortal;
  onOpen: () => void;
  children: ReactNode;
}) {
  const muted = !portal.available;
  const featured = portal.layout === "featured";

  return (
    <StaggerItem className={LAYOUT_CLASS[portal.layout]}>
      <PressableCard className="h-full">
        <button
          type="button"
          data-facet={portal.id}
          onClick={onOpen}
          className={`facet-portal-button group relative flex h-full w-full flex-col overflow-hidden rounded-2xl border text-left transition-colors ${
            featured
              ? "facet-portal--featured border-world-accent/35 bg-surface/90 px-5 py-4 shadow-[0_0_40px_-16px_var(--world-glow)]"
              : muted
                ? "border-border/35 bg-surface/35 px-4 py-3.5 hover:border-border/55"
                : "border-border/60 bg-surface/75 px-4 py-3.5 hover:bg-surface"
          }`}
        >
          <div
            className="facet-portal-gradient pointer-events-none absolute inset-0"
            aria-hidden
          />
          {featured && (
            <div
              className="pointer-events-none absolute -right-6 -top-6 h-24 w-24 rounded-full opacity-60 blur-2xl"
              style={{ background: "var(--world-glow)" }}
              aria-hidden
            />
          )}
          <div className="relative z-10 flex min-h-0 flex-1 flex-col">
            <div className="flex items-start justify-between gap-2">
              <span className="text-[10px] font-medium uppercase tracking-[0.2em] text-world-accent opacity-90">
                {portal.title}
                {featured && (
                  <span className="ml-1.5 normal-case tracking-normal text-muted/70">
                    · focus
                  </span>
                )}
              </span>
              <span
                className={`transition-transform group-hover:translate-x-0.5 ${
                  featured ? "text-world-accent" : "text-muted/50 group-hover:text-muted"
                }`}
                aria-hidden
              >
                →
              </span>
            </div>
            <PortalInvitation portal={portal} />
            {children}
          </div>
        </button>
      </PressableCard>
    </StaggerItem>
  );
}

function ScenePortalCard({
  portal,
  onOpen,
}: {
  portal: Extract<FacetPortal, { id: "scene" }>;
  onOpen: () => void;
}) {
  const featured = portal.layout === "featured";
  const chipLimit = featured ? 8 : 4;

  return (
    <PortalShell portal={portal} onOpen={onOpen}>
      {portal.available && portal.chips.length > 0 ? (
        <div className="mt-3 flex flex-wrap gap-1.5">
          {portal.chips.slice(0, chipLimit).map((chip) => (
            <span
              key={chip}
              className={`rounded-full border border-emerald-500/25 bg-emerald-500/10 font-medium capitalize text-foreground/90 ${
                featured ? "px-3 py-1 text-xs" : "px-2.5 py-0.5 text-[11px]"
              }`}
            >
              {chip}
            </span>
          ))}
        </div>
      ) : null}
      {portal.available && featured && portal.teaser && (
        <p className="mt-3 line-clamp-2 text-sm leading-relaxed text-muted">
          {portal.teaser}
        </p>
      )}
    </PortalShell>
  );
}

function PeoplePortalCard({
  portal,
  onOpen,
}: {
  portal: Extract<FacetPortal, { id: "people" }>;
  onOpen: () => void;
}) {
  const featured = portal.layout === "featured";
  const avatarLimit = featured ? 5 : 4;
  const size = featured ? "h-10 w-10 text-[11px]" : "h-9 w-9 text-[10px]";

  return (
    <PortalShell portal={portal} onOpen={onOpen}>
      {portal.available && portal.avatars.length > 0 ? (
        <div className="mt-3 flex items-center gap-2">
          <div className="flex -space-x-2">
            {portal.avatars.slice(0, avatarLimit).map((person) => (
              <span
                key={person.name}
                title={person.name}
                className={`flex shrink-0 items-center justify-center rounded-full border-2 border-surface bg-violet-500/25 font-semibold text-foreground/90 ring-1 ring-violet-500/20 ${size}`}
              >
                {person.initials}
              </span>
            ))}
          </div>
          {portal.totalCount > avatarLimit && (
            <span className="text-[10px] text-muted">
              +{portal.totalCount - avatarLimit}
            </span>
          )}
        </div>
      ) : null}
      {portal.available && featured && portal.namePreview && (
        <p className="mt-3 line-clamp-2 text-sm text-muted">{portal.namePreview}</p>
      )}
    </PortalShell>
  );
}

function PlaylistPortalCard({
  portal,
  onOpen,
}: {
  portal: Extract<FacetPortal, { id: "playlist" }>;
  onOpen: () => void;
}) {
  const featured = portal.layout === "featured";
  const coverLimit = featured ? 5 : 3;
  const coverSize = featured ? "h-14 w-14" : "h-11 w-11";

  return (
    <PortalShell portal={portal} onOpen={onOpen}>
      {portal.available && portal.trackCount > 0 ? (
        <div className="mt-3 flex items-end pl-1">
          <div className="flex items-end">
            {portal.coverUrls.length > 0 ? (
              portal.coverUrls.slice(0, coverLimit).map((url, i) => (
                <div
                  key={`${url}-${i}`}
                  className={`relative -ml-3 shrink-0 overflow-hidden rounded-lg border-2 border-surface shadow-md first:ml-0 ${coverSize}`}
                  style={{ zIndex: coverLimit - i }}
                >
                  {/* eslint-disable-next-line @next/next/no-img-element */}
                  <img
                    src={url}
                    alt=""
                    className="h-full w-full object-cover"
                    loading="lazy"
                  />
                </div>
              ))
            ) : (
              <div className="flex -space-x-2">
                {[0, 1, 2].map((i) => (
                  <div
                    key={i}
                    className={`-ml-2 rounded-lg border-2 border-surface bg-world-accent-muted first:ml-0 ${coverSize}`}
                  />
                ))}
              </div>
            )}
          </div>
        </div>
      ) : null}
    </PortalShell>
  );
}

function ReleasePortalCard({
  portal,
  onOpen,
}: {
  portal: Extract<FacetPortal, { id: "release" }>;
  onOpen: () => void;
}) {
  const featured = portal.layout === "featured";

  return (
    <PortalShell portal={portal} onOpen={onOpen}>
      {portal.available && (
        <div className={`mt-3 flex gap-3 ${featured ? "items-center" : ""}`}>
          <div
            className={`relative shrink-0 overflow-hidden rounded-md shadow-[2px_4px_12px_-2px_rgba(0,0,0,0.5)] ring-1 ring-white/10 ${
              featured ? "h-20 w-20" : "h-14 w-14"
            }`}
          >
            <ArtworkImage
              src={portal.artworkUrl}
              alt={`${portal.albumTitle} sleeve`}
              sizes={featured ? "80px" : "56px"}
              className="object-cover"
            />
          </div>
          <div className="min-w-0 flex-1">
            <p
              className={`line-clamp-2 font-display font-medium leading-snug ${
                featured ? "text-lg" : "text-base"
              }`}
            >
              {portal.albumTitle}
            </p>
            {(portal.label || portal.year) && (
              <div className="mt-2 flex flex-wrap items-center gap-1.5">
                {portal.label && (
                  <span className="rounded border border-sky-500/30 bg-sky-500/10 px-1.5 py-0.5 text-[9px] font-medium uppercase tracking-wider text-sky-200/90">
                    {portal.label}
                  </span>
                )}
                {portal.year && (
                  <span className="font-display text-sm tabular-nums text-muted">
                    {portal.year}
                  </span>
                )}
              </div>
            )}
          </div>
        </div>
      )}
    </PortalShell>
  );
}

function ConnectedPortalCard({
  portal,
  onOpen,
}: {
  portal: Extract<FacetPortal, { id: "connected" }>;
  onOpen: () => void;
}) {
  const previewLimit = portal.layout === "featured" ? 3 : 2;

  return (
    <PortalShell portal={portal} onOpen={onOpen}>
      {portal.available && portal.previews.length > 0 ? (
        <ul className="mt-3 space-y-2">
          {portal.previews.slice(0, previewLimit).map((track) => (
            <li
              key={`${track.title}-${track.artist}`}
              className="flex items-center gap-2 rounded-lg border border-border/40 bg-background/30 px-2 py-1.5"
            >
              <div className="relative h-8 w-8 shrink-0 overflow-hidden rounded-md bg-surface">
                {track.artworkUrl ? (
                  // eslint-disable-next-line @next/next/no-img-element
                  <img
                    src={track.artworkUrl}
                    alt=""
                    className="h-full w-full object-cover"
                    loading="lazy"
                  />
                ) : (
                  <div className="h-full w-full bg-gradient-to-br from-rose-500/15 to-transparent" />
                )}
              </div>
              <div className="min-w-0 flex-1">
                <p className="truncate text-xs font-medium">{track.title}</p>
                <p className="truncate text-[10px] text-muted">{track.artist}</p>
              </div>
            </li>
          ))}
        </ul>
      ) : null}
    </PortalShell>
  );
}

function VibePortalCard({
  portal,
  onOpen,
}: {
  portal: Extract<FacetPortal, { id: "vibe" }>;
  onOpen: () => void;
}) {
  const featured = portal.layout === "featured";
  const chipLimit = featured ? 5 : 3;

  return (
    <PortalShell portal={portal} onOpen={onOpen}>
      {portal.available && portal.chips.length > 0 ? (
        <>
          <div className="mt-3 flex flex-wrap gap-1.5">
            {portal.chips.slice(0, chipLimit).map((chip, index) => (
              <span
                key={chip}
                className={`rounded-full border font-medium capitalize ${
                  featured ? "px-3 py-1 text-xs" : "px-2.5 py-1 text-[11px]"
                } ${
                  index === 0
                    ? "border-world-accent bg-world-accent-muted text-world-accent"
                    : "border-border/50 bg-background/40 text-foreground/80"
                }`}
              >
                {chip}
              </span>
            ))}
          </div>
          {portal.sentence && (
            <p
              className={`mt-3 leading-relaxed text-muted ${
                featured ? "line-clamp-3 text-sm" : "line-clamp-2 text-xs"
              }`}
            >
              {portal.sentence}
            </p>
          )}
        </>
      ) : null}
    </PortalShell>
  );
}

export function FacetPortalCard({
  portal,
  onOpen,
}: {
  portal: FacetPortal;
  onOpen: () => void;
}) {
  switch (portal.id) {
    case "scene":
      return <ScenePortalCard portal={portal} onOpen={onOpen} />;
    case "people":
      return <PeoplePortalCard portal={portal} onOpen={onOpen} />;
    case "playlist":
      return <PlaylistPortalCard portal={portal} onOpen={onOpen} />;
    case "release":
      return <ReleasePortalCard portal={portal} onOpen={onOpen} />;
    case "connected":
      return <ConnectedPortalCard portal={portal} onOpen={onOpen} />;
    case "vibe":
      return <VibePortalCard portal={portal} onOpen={onOpen} />;
    default:
      return null;
  }
}
