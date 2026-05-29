import Link from "next/link";

type StoryFetchErrorProps = {
  message: string;
  code?: string;
};

export function StoryFetchError({ message, code }: StoryFetchErrorProps) {
  return (
    <div className="flex flex-col gap-6 py-8">
      <div className="rounded-3xl border border-red-500/20 bg-red-500/5 p-6">
        <p className="text-[10px] font-medium uppercase tracking-[0.2em] text-red-300/80">
          Story unavailable
        </p>
        <h1 className="mt-2 font-display text-2xl font-medium">{message}</h1>
        {code && (
          <p className="mt-2 text-sm text-muted">
            Error code: <span className="font-mono">{code}</span>
          </p>
        )}
      </div>

      <Link
        href="/"
        className="inline-flex w-full items-center justify-center rounded-2xl border border-border bg-surface px-4 py-3 text-sm font-medium transition-colors hover:border-accent/30"
      >
        Try another track
      </Link>
    </div>
  );
}
