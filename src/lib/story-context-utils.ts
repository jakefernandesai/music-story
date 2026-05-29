import type { PeopleByRole, ReleaseWorld } from "./types";

export function releaseWorldIsRich(world: ReleaseWorld | null): boolean {
  if (!world) return false;
  return Boolean(world.label || world.country || world.catalogNumber || world.format);
}

export function countPeople(people: PeopleByRole): number {
  return (
    people.producers.length +
    people.writers.length +
    people.performers.length +
    people.remixers.length +
    people.engineers.length
  );
}
