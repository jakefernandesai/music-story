"use client";

import type { MusicStory } from "@/lib/types";
import {
  getRelationshipLabel,
  getSectionAccent,
  groupStoryNodes,
} from "@/lib/story-sections";
import { FadeIn, StaggerGroup, StaggerItem } from "@/components/motion";
import { StoryNodeCard } from "@/components/StoryNodeCard";

type GenreScenePanelProps = Pick<MusicStory, "nodes" | "edges" | "rootTrack">;

export function GenreScenePanel({ nodes, edges, rootTrack }: GenreScenePanelProps) {
  const story = { nodes, edges, rootTrack } as MusicStory;
  const section = groupStoryNodes(story).find((s) => s.id === "genre-scene");

  if (!section || section.nodes.length === 0) {
    return (
      <p className="text-sm leading-relaxed text-muted">
        No genre or scene nodes yet — MusicBrainz and story graph data may fill
        this in later.
      </p>
    );
  }

  return (
    <FadeIn>
      <section aria-label="Genre and scene">
        <div
          className={`pointer-events-none mb-4 h-16 rounded-2xl bg-gradient-to-r opacity-50 ${getSectionAccent("genre-scene")}`}
          aria-hidden
        />
        <p className="text-sm leading-relaxed text-muted">{section.subtitle}</p>
        <StaggerGroup className="mt-5 space-y-3" delayChildren={0.06}>
          {section.nodes.map((node) => (
            <StaggerItem key={node.id}>
              <StoryNodeCard
                node={node}
                relationshipLabel={getRelationshipLabel(story, node.id)}
              />
            </StaggerItem>
          ))}
        </StaggerGroup>
      </section>
    </FadeIn>
  );
}
