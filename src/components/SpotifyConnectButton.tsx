"use client";

import { usePathname, useSearchParams } from "next/navigation";
import { useEffect, useMemo, useState } from "react";

type SessionState =
  | { status: "loading" }
  | { status: "anonymous" }
  | { status: "authenticated"; displayName: string };

type SessionResponse = {
  loggedIn: boolean;
  displayName?: string;
};

function applySessionResponse(
  data: SessionResponse,
  setSession: (state: SessionState) => void,
) {
  if (data.loggedIn) {
    setSession({
      status: "authenticated",
      displayName: data.displayName ?? "Spotify user",
    });
    return;
  }

  setSession({ status: "anonymous" });
}

export function SpotifyConnectButton() {
  const pathname = usePathname();
  const searchParams = useSearchParams();
  const returnTo = useMemo(() => {
    const query = searchParams.toString();
    return query ? `${pathname}?${query}` : pathname;
  }, [pathname, searchParams]);

  const [session, setSession] = useState<SessionState>({ status: "loading" });

  useEffect(() => {
    let cancelled = false;

    fetch("/api/auth/spotify/session")
      .then((response) => response.json() as Promise<SessionResponse>)
      .then((data) => {
        if (!cancelled) applySessionResponse(data, setSession);
      })
      .catch(() => {
        if (!cancelled) setSession({ status: "anonymous" });
      });

    return () => {
      cancelled = true;
    };
  }, []);

  async function handleLogout() {
    await fetch("/api/auth/spotify/session", { method: "DELETE" });
    setSession({ status: "anonymous" });
  }

  if (session.status === "loading") {
    return (
      <span className="text-xs text-muted">Checking Spotify session…</span>
    );
  }

  if (session.status === "authenticated") {
    return (
      <div className="flex items-center gap-3">
        <span className="text-xs text-muted">
          Connected as{" "}
          <span className="text-foreground/80">{session.displayName}</span>
        </span>
        <button
          type="button"
          onClick={() => void handleLogout()}
          className="text-xs text-muted underline-offset-2 hover:text-foreground hover:underline"
        >
          Disconnect
        </button>
      </div>
    );
  }

  return (
    <a
      href={`/api/auth/spotify?returnTo=${encodeURIComponent(returnTo)}`}
      className="rounded-full border border-border bg-surface px-3 py-1.5 text-xs font-medium text-foreground transition-colors hover:border-accent/30"
    >
      Connect Spotify
    </a>
  );
}

export function useSpotifySession() {
  const [loggedIn, setLoggedIn] = useState<boolean | null>(null);
  const [displayName, setDisplayName] = useState<string | null>(null);

  async function refresh() {
    const response = await fetch("/api/auth/spotify/session");
    const data = (await response.json()) as SessionResponse;
    setLoggedIn(data.loggedIn);
    setDisplayName(data.displayName ?? null);
  }

  useEffect(() => {
    let cancelled = false;

    fetch("/api/auth/spotify/session")
      .then((response) => response.json() as Promise<SessionResponse>)
      .then((data) => {
        if (cancelled) return;
        setLoggedIn(data.loggedIn);
        setDisplayName(data.displayName ?? null);
      })
      .catch(() => {
        if (!cancelled) setLoggedIn(false);
      });

    return () => {
      cancelled = true;
    };
  }, []);

  return { loggedIn, displayName, refresh };
}
