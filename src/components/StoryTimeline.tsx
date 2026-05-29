"use client";

import type { MusicStory } from "@/lib/types";
import {
  getRelationshipLabel,
  getSectionAccent,
  groupStoryNodes,
} from "@/lib/story-sections";
import { RevealLine, RevealOnScroll } from "@/components/motion";
import { StoryNodeCard } from "./StoryNodeCard";

type StoryTimelineProps = Pick<MusicStory, "nodes" | "edges" | "rootTrack">;

export function StoryTimeline({ nodes, edges, rootTrack }: StoryTimelineProps) {
  const story = { nodes, edges, rootTrack } as MusicStory;
  const sections = groupStoryNodes(story);

  return (
    <section aria-label="Music story timeline" className="relative">
      <RevealOnScroll className="mb-10">
        <p className="text-xs font-medium uppercase tracking-[0.25em] text-accent">
          The thread
        </p>
        <h2 className="mt-2 font-display text-3xl font-medium leading-tight">
          Explore recommendations
        </h2>
        <p className="mt-3 max-w-sm text-sm leading-relaxed text-muted">
          Each layer pulls you deeper — from the track itself out into the
          people, release, culture, and connections that shaped it.
        </p>
      </RevealOnScroll>

      <div className="relative space-y-16">
        {sections.map((section, sectionIndex) => (
          <RevealOnScroll
            key={section.id}
            delay={sectionIndex * 0.05}
            className="relative"
          >
            {sectionIndex > 0 && (
              <RevealLine className="pointer-events-none absolute -top-10 left-5 h-10 w-px bg-gradient-to-b from-transparent to-border" />
            )}

            <div className="relative pl-12">
              <div
                className="absolute left-0 top-1 flex h-10 w-10 items-center justify-center rounded-full border border-accent/30 bg-surface font-display text-sm text-accent"
                aria-hidden
              >
                {section.step.toString().padStart(2, "0")}
              </div>

              <div
                className={`absolute -left-5 top-14 bottom-0 w-20 rounded-full bg-gradient-to-b opacity-60 blur-2xl ${getSectionAccent(section.id)}`}
                aria-hidden
              />

              <header className="mb-6">
                <h3 className="font-display text-xl font-medium">
                  {section.title}
                </h3>
                <p className="mt-1 text-sm text-muted">{section.subtitle}</p>
              </header>

              <ol className="relative space-y-5">
                <RevealLine className="absolute -left-[2.125rem] top-3 bottom-3 w-px bg-gradient-to-b from-accent/50 via-border/80 to-border/30" />

                {section.nodes.map((node, nodeIndex) => {
                  const isFirstInStory =
                    sectionIndex === 0 && nodeIndex === 0;
                  const relationshipLabel = isFirstInStory
                    ? undefined
                    : getRelationshipLabel(story, node.id);

                  return (
                    <li key={node.id} className="relative">
                      <div
                        className="absolute -left-[2.375rem] top-8 h-2 w-2 rounded-full border border-accent/50 bg-background"
                        aria-hidden
                      />

                      <RevealOnScroll delay={nodeIndex * 0.07} y={18}>
                        <StoryNodeCard
                          node={node}
                          relationshipLabel={relationshipLabel}
                          variant={isFirstInStory ? "featured" : "default"}
                        />
                      </RevealOnScroll>
                    </li>
                  );
                })}
              </ol>

              {sectionIndex < sections.length - 1 && (
                <p className="mt-6 text-xs italic text-muted/70">
                  Keep scrolling — there&apos;s more below the surface.
                </p>
              )}
            </div>
          </RevealOnScroll>
        ))}
      </div>
    </section>
  );
}
