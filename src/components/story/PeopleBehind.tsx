"use client";

import { useState } from "react";
import type { PeopleByRole, PersonCredit } from "@/lib/types";
import { FadeIn } from "@/components/motion";
import { countPeople } from "@/lib/story-context-utils";

const ROLE_CONFIG: Array<{
  key: keyof PeopleByRole;
  label: string;
}> = [
  { key: "producers", label: "Producers" },
  { key: "writers", label: "Writers" },
  { key: "performers", label: "Performers" },
  { key: "remixers", label: "Remixers" },
  { key: "engineers", label: "Engineers" },
];

const DEFAULT_VISIBLE = 3;

type PeopleBehindProps = {
  people: PeopleByRole;
};

function RoleGroup({
  label,
  people,
}: {
  label: string;
  people: PersonCredit[];
}) {
  const [expanded, setExpanded] = useState(false);
  if (people.length === 0) return null;

  const visible = expanded ? people : people.slice(0, DEFAULT_VISIBLE);
  const hasMore = people.length > DEFAULT_VISIBLE;

  return (
    <div>
      <h3 className="text-[10px] font-medium uppercase tracking-[0.18em] text-muted">
        {label}
      </h3>
      <ul className="mt-1.5 space-y-1">
        {visible.map((person) => (
          <li
            key={`${label}-${person.name}`}
            className="flex items-baseline justify-between gap-2 text-sm"
          >
            <span className="font-medium">{person.name}</span>
            {person.role && (
              <span className="shrink-0 text-xs text-muted">{person.role}</span>
            )}
          </li>
        ))}
      </ul>
      {hasMore && !expanded && (
        <button
          type="button"
          onClick={() => setExpanded(true)}
          className="mt-1.5 text-xs text-accent hover:underline"
        >
          Show all ({people.length})
        </button>
      )}
    </div>
  );
}

export function PeopleBehind({ people }: PeopleBehindProps) {
  if (countPeople(people) === 0) return null;

  return (
    <FadeIn>
      <section aria-label="People behind it" className="rounded-2xl border border-border/60 bg-surface/50 px-4 py-4">
        <h2 className="font-display text-lg font-medium">People behind it</h2>
        <div className="mt-4 grid gap-4 sm:grid-cols-2">
          {ROLE_CONFIG.map(({ key, label }) => (
            <RoleGroup key={key} label={label} people={people[key]} />
          ))}
        </div>
      </section>
    </FadeIn>
  );
}
