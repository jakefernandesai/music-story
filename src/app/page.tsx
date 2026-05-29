import { TrackInput } from "@/components/TrackInput";

export default function HomePage() {
  return (
    <div className="flex flex-col gap-12 pt-4">
      <section className="space-y-6">
        <div className="space-y-4">
          <p className="text-xs font-medium uppercase tracking-[0.25em] text-accent">
            Editorial music discovery
          </p>
          <h1 className="font-display text-4xl font-medium leading-[1.15] tracking-tight sm:text-5xl">
            Paste a Spotify song. Get a mini playlist of tracks you might not have heard yet.
          </h1>
          <p className="max-w-md text-base leading-relaxed text-muted">
            We use tags, scenes and connected artists to build the route.
          </p>
        </div>

        <div className="relative overflow-hidden rounded-3xl border border-border bg-surface p-6">
          <div
            className="pointer-events-none absolute -right-8 -top-8 h-32 w-32 rounded-full bg-accent/10 blur-3xl"
            aria-hidden
          />
          <TrackInput />
        </div>
      </section>

      <section className="space-y-6 border-t border-border pt-10">
        <h2 className="font-display text-lg font-medium text-foreground/90">
          How it works
        </h2>
        <ol className="space-y-5">
          {[
            {
              step: "01",
              title: "Paste a track URL",
              detail: "Any public Spotify track link works.",
            },
            {
              step: "02",
              title: "We read the context",
              detail: "Tags, scenes, and connected artists shape what feels nearby.",
            },
            {
              step: "03",
              title: "Pick your playlist",
              detail:
                "Preview tracks, choose the ones you want, and save a Spotify playlist in one tap.",
            },
          ].map((item) => (
            <li key={item.step} className="flex gap-4">
              <span className="font-display text-sm text-accent">{item.step}</span>
              <div>
                <p className="font-medium">{item.title}</p>
                <p className="mt-1 text-sm text-muted">{item.detail}</p>
              </div>
            </li>
          ))}
        </ol>
      </section>
    </div>
  );
}
