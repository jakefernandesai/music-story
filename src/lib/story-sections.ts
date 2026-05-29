import type { MusicStory, StoryEdge, StoryNode, StoryNodeType } from "./types";

export type StorySectionId =
  | "track"
  | "people"
  | "release"
  | "genre-scene"
  | "connected";

export type StorySection = {
  id: StorySectionId;
  step: number;
  title: string;
  subtitle: string;
  nodes: StoryNode[];
};

const SECTIONS: Array<{
  id: StorySectionId;
  title: string;
  subtitle: string;
  types: StoryNodeType[];
}> = [
  {
    id: "track",
    title: "The track",
    subtitle: "Where recommendations begin",
    types: ["track"],
  },
  {
    id: "people",
    title: "People behind it",
    subtitle: "Performers, producers, and collaborators",
    types: ["artist", "producer", "songwriter", "collaborator"],
  },
  {
    id: "release",
    title: "Release world",
    subtitle: "Album, label, and how it reached the world",
    types: ["album", "label"],
  },
  {
    id: "genre-scene",
    title: "Genre and scene",
    subtitle: "The sound and the culture around it",
    types: ["genre", "scene"],
  },
  {
    id: "connected",
    title: "Connected tracks",
    subtitle: "Samples, covers, and remix lineage",
    types: ["track", "sample", "cover", "remix"],
  },
];

const NODE_ORDER: StoryNodeType[] = [
  "track",
  "artist",
  "producer",
  "songwriter",
  "collaborator",
  "album",
  "label",
  "genre",
  "scene",
  "sample",
  "cover",
  "remix",
];

function sortNodes(nodes: StoryNode[]): StoryNode[] {
  return [...nodes].sort(
    (a, b) => NODE_ORDER.indexOf(a.type) - NODE_ORDER.indexOf(b.type),
  );
}

export function groupStoryNodes(story: MusicStory): StorySection[] {
  const assigned = new Set<string>();

  return SECTIONS.map((section, index) => {
    const nodes = sortNodes(
      story.nodes.filter((node) => {
        if (!section.types.includes(node.type) || assigned.has(node.id)) {
          return false;
        }
        assigned.add(node.id);
        return true;
      }),
    );

    return {
      id: section.id,
      step: index + 1,
      title: section.title,
      subtitle: section.subtitle,
      nodes,
    };
  }).filter((section) => section.nodes.length > 0);
}

export function getRootTrackNode(story: MusicStory): StoryNode | undefined {
  return (
    story.nodes.find(
      (node) =>
        node.type === "track" && node.entityId === story.rootTrack.id,
    ) ?? story.nodes.find((node) => node.type === "track")
  );
}

export function getRelationshipLabel(
  story: MusicStory,
  nodeId: string,
): string | undefined {
  const edge = findRelationshipEdge(story, nodeId);
  return edge?.label;
}

export function findRelationshipEdge(
  story: MusicStory,
  nodeId: string,
): StoryEdge | undefined {
  const rootNode = getRootTrackNode(story);
  if (!rootNode) return undefined;

  const fromRoot = story.edges.find(
    (edge) =>
      edge.sourceNodeId === rootNode.id && edge.targetNodeId === nodeId,
  );
  if (fromRoot) return fromRoot;

  return story.edges.find((edge) => edge.targetNodeId === nodeId);
}

export function getSectionAccent(id: StorySectionId): string {
  const accents: Record<StorySectionId, string> = {
    track: "from-accent/40 to-accent/5",
    people: "from-violet-500/25 to-transparent",
    release: "from-sky-500/20 to-transparent",
    "genre-scene": "from-emerald-500/20 to-transparent",
    connected: "from-rose-500/20 to-transparent",
  };
  return accents[id];
}
