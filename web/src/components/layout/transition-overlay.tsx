"use client";

import { AnimatePresence, motion } from "framer-motion";

/**
 * Progress indicator shown while the active symbol/timeframe reloads.
 *
 * Only a thin animated bar pinned to the top edge is shown. The dashboard
 * beneath stays fully visible so each section can reveal its content
 * independently as soon as its own data resolves — instead of every section
 * waiting for the slowest query behind a full-area veil.
 *
 * Pointer events are disabled so the UI beneath stays interactive.
 */
export function TransitionOverlay({ active }: { active: boolean }) {
  return (
    <AnimatePresence>
      {active && (
        <motion.div
          key="transition-overlay"
          className="pointer-events-none absolute inset-0 z-30 overflow-hidden rounded-inherit"
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          exit={{ opacity: 0 }}
          transition={{ duration: 0.18, ease: "easeOut" }}
          aria-hidden
        >
          {/* Top progress bar — the only visible layer.
              The old dim/blur veil + centered logo were removed so each
              section reveals independently as its data resolves, instead
              of the whole dashboard waiting for the slowest query. */}
          <div className="absolute left-0 right-0 top-0 h-0.5 transition-bar" />
        </motion.div>
      )}
    </AnimatePresence>
  );
}
