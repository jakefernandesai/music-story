import type { MissingData } from "@/lib/types";

type MissingDataNoticeProps = {
  items: MissingData[];
};

export function MissingDataNotice({ items }: MissingDataNoticeProps) {
  if (items.length === 0) return null;

  return (
    <aside
      className="rounded-2xl border border-dashed border-border/80 bg-surface/50 px-5 py-4"
      aria-label="Missing data notice"
    >
      <p className="text-[10px] font-medium uppercase tracking-[0.2em] text-muted">
        Unresolved
      </p>
      <p className="mt-2 text-sm leading-relaxed text-muted">
        {items.length} gap{items.length === 1 ? "" : "s"} in the story — some
        threads couldn&apos;t be verified yet.
      </p>

      <ul className="mt-4 space-y-3">
        {items.map((item) => (
          <li key={item.field} className="flex gap-3 text-sm">
            <span className="mt-1.5 h-1 w-1 shrink-0 rounded-full bg-muted/60" />
            <div>
              <span className="font-medium text-foreground/85">
                {item.field}
              </span>
              <span className="text-muted"> — {item.description}</span>
            </div>
          </li>
        ))}
      </ul>
    </aside>
  );
}
