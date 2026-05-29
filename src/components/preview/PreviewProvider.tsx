"use client";

import { AnimatePresence, motion } from "framer-motion";
import {
  createContext,
  useCallback,
  useContext,
  useRef,
  useState,
  type ReactNode,
} from "react";

type PreviewContextValue = {
  playingId: string | null;
  toggle: (id: string, previewUrl: string) => void;
  stop: () => void;
};

const PreviewContext = createContext<PreviewContextValue | null>(null);

export function PreviewProvider({ children }: { children: ReactNode }) {
  const audioRef = useRef<HTMLAudioElement | null>(null);
  const [playingId, setPlayingId] = useState<string | null>(null);

  const stop = useCallback(() => {
    if (audioRef.current) {
      audioRef.current.pause();
      audioRef.current = null;
    }
    setPlayingId(null);
  }, []);

  const toggle = useCallback(
    (id: string, previewUrl: string) => {
      if (playingId === id) {
        stop();
        return;
      }

      stop();
      const audio = new Audio(previewUrl);
      audioRef.current = audio;
      setPlayingId(id);

      void audio.play().catch(() => {
        stop();
      });

      audio.onended = () => stop();
    },
    [playingId, stop],
  );

  return (
    <PreviewContext.Provider value={{ playingId, toggle, stop }}>
      {children}
    </PreviewContext.Provider>
  );
}

export function usePreview() {
  const context = useContext(PreviewContext);
  if (!context) {
    throw new Error("usePreview must be used within PreviewProvider");
  }
  return context;
}

type PreviewButtonProps = {
  trackId: string;
  previewUrl?: string | null;
  size?: "sm" | "md";
};

export function PreviewButton({ trackId, previewUrl, size = "md" }: PreviewButtonProps) {
  const { playingId, toggle } = usePreview();
  const dim = size === "sm" ? "h-8 w-8" : "h-9 w-9";
  const icon = size === "sm" ? 11 : 12;

  if (!previewUrl) {
    return null;
  }

  const isPlaying = playingId === trackId;

  return (
    <motion.button
      type="button"
      onClick={() => toggle(trackId, previewUrl)}
      whileTap={{ scale: 0.92 }}
      className={`relative flex ${dim} shrink-0 items-center justify-center rounded-full border transition-colors duration-200 ${
        isPlaying
          ? "border-accent bg-accent/15 text-accent shadow-[0_0_16px_-4px_rgba(201,169,98,0.45)]"
          : "border-border/60 bg-surface-elevated/50 text-foreground/75 active:bg-surface-elevated"
      }`}
      aria-label={isPlaying ? "Pause preview" : "Play preview"}
      aria-pressed={isPlaying}
    >
      <AnimatePresence mode="wait" initial={false}>
        {isPlaying ? (
          <motion.span
            key="pause"
            initial={{ opacity: 0, scale: 0.6 }}
            animate={{ opacity: 1, scale: 1 }}
            exit={{ opacity: 0, scale: 0.6 }}
            transition={{ duration: 0.15 }}
            className="flex"
          >
            <svg width={icon} height={icon} viewBox="0 0 24 24" fill="currentColor">
              <rect x="6" y="5" width="4" height="14" rx="0.5" />
              <rect x="14" y="5" width="4" height="14" rx="0.5" />
            </svg>
          </motion.span>
        ) : (
          <motion.span
            key="play"
            initial={{ opacity: 0, scale: 0.6 }}
            animate={{ opacity: 1, scale: 1 }}
            exit={{ opacity: 0, scale: 0.6 }}
            transition={{ duration: 0.15 }}
            className="flex pl-0.5"
          >
            <svg width={icon} height={icon} viewBox="0 0 24 24" fill="currentColor">
              <path d="M8 5v14l11-7z" />
            </svg>
          </motion.span>
        )}
      </AnimatePresence>
      {isPlaying && (
        <motion.span
          className="pointer-events-none absolute inset-0 rounded-full border border-accent/40"
          animate={{ scale: [1, 1.12, 1], opacity: [0.5, 0, 0.5] }}
          transition={{ duration: 1.6, repeat: Infinity, ease: "easeInOut" }}
        />
      )}
    </motion.button>
  );
}
