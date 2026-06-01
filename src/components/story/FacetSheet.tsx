"use client";

import { AnimatePresence, motion } from "framer-motion";
import { useCallback, useEffect, useId, type ReactNode } from "react";
import { useMotionConfig } from "@/components/motion";

type FacetSheetProps = {
  open: boolean;
  title: string;
  subtitle?: string;
  onClose: () => void;
  children: ReactNode;
};

export function FacetSheet({
  open,
  title,
  subtitle,
  onClose,
  children,
}: FacetSheetProps) {
  const { reduced, spring } = useMotionConfig();
  const titleId = useId();

  const handleKeyDown = useCallback(
    (event: KeyboardEvent) => {
      if (event.key === "Escape") onClose();
    },
    [onClose],
  );

  useEffect(() => {
    if (!open) return;
    document.addEventListener("keydown", handleKeyDown);
    const prev = document.body.style.overflow;
    document.body.style.overflow = "hidden";
    return () => {
      document.removeEventListener("keydown", handleKeyDown);
      document.body.style.overflow = prev;
    };
  }, [open, handleKeyDown]);

  return (
    <AnimatePresence>
      {open && (
        <div className="fixed inset-0 z-50 flex flex-col justify-end sm:justify-center sm:p-5">
          <motion.button
            type="button"
            className="absolute inset-0 bg-background/75 backdrop-blur-sm"
            aria-label="Close"
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            transition={{ duration: reduced ? 0 : 0.2 }}
            onClick={onClose}
          />

          <motion.div
            role="dialog"
            aria-modal="true"
            aria-labelledby={titleId}
            className="world-facet-sheet-panel relative z-10 flex max-h-[min(92vh,720px)] w-full flex-col overflow-hidden rounded-t-3xl border bg-background shadow-[0_-24px_80px_-20px_rgba(0,0,0,0.85)] sm:mx-auto sm:max-w-lg sm:rounded-3xl"
            initial={reduced ? false : { y: "100%", opacity: 0.9 }}
            animate={{ y: 0, opacity: 1 }}
            exit={reduced ? undefined : { y: "100%", opacity: 0.9 }}
            transition={spring}
          >
            <div className="world-facet-sheet-header flex shrink-0 items-start justify-between gap-4 border-b px-5 py-4">
              <div className="min-w-0">
                <h2
                  id={titleId}
                  className="font-display text-xl font-medium leading-tight"
                >
                  {title}
                </h2>
                {subtitle && (
                  <p className="mt-1 text-sm text-muted">{subtitle}</p>
                )}
              </div>
              <button
                type="button"
                onClick={onClose}
                className="flex h-9 w-9 shrink-0 items-center justify-center rounded-full border border-border/60 text-muted transition-colors hover:border-world-accent hover:text-foreground"
                aria-label="Close"
              >
                <span aria-hidden className="text-lg leading-none">
                  ×
                </span>
              </button>
            </div>

            <div className="min-h-0 flex-1 overflow-y-auto overscroll-contain px-5 py-5">
              {children}
            </div>
          </motion.div>
        </div>
      )}
    </AnimatePresence>
  );
}
