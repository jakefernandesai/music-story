import type { FacetPortal, FacetPortalLayout } from "./track-hub-summaries";

export function buildFacetInvitation(
  portal: FacetPortal,
  layout: FacetPortalLayout,
): string {
  const featured = layout === "featured";

  switch (portal.id) {
    case "scene":
      return featured
        ? "Follow this scene further — the heart of this world"
        : "Follow this scene further";

    case "people":
      return featured
        ? "Meet the people behind this sound"
        : "Meet the people behind it";

    case "playlist":
      if (!portal.available || portal.trackCount === 0) {
        return "Paths from this world are still forming";
      }
      return featured
        ? "Continue down this rabbit hole"
        : "Keep exploring nearby tracks";

    case "release":
      return featured
        ? "Step into where this record lives"
        : "Explore the release story";

    case "connected":
      if (!portal.available) {
        return "Connections are still emerging";
      }
      return featured
        ? "Trace remixes, covers and versions"
        : "See what links to this track";

    case "vibe":
      if (!portal.available) {
        return "Taste around this artist is still surfacing";
      }
      return featured
        ? "Feel the mood around this artist"
        : "Read the vibe signature";

    default:
      return "Explore further";
  }
}

export function facetDetailHint(portal: FacetPortal): string | null {
  switch (portal.id) {
    case "people":
      return portal.available && portal.totalCount > 0
        ? `${portal.totalCount} voices in the credits`
        : null;
    case "playlist":
      return portal.available && portal.trackCount > 0
        ? `${portal.trackCount} paths to follow`
        : null;
    case "connected":
      return portal.available && portal.previews.length > 0
        ? `${portal.previews.length}+ linked tracks`
        : null;
    case "release":
      return portal.year ? `Released ${portal.year}` : null;
    default:
      return null;
  }
}
