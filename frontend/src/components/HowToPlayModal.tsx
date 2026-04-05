"use client";

import { useCallback, useEffect, useRef } from "react";

type HowToPlayModalProps = {
  open: boolean;
  onClose: () => void;
};

export function HowToPlayModal({ open, onClose }: HowToPlayModalProps) {
  const dialogRef = useRef<HTMLDivElement>(null);
  const closeRef = useRef<HTMLButtonElement>(null);
  const previousActiveRef = useRef<HTMLElement | null>(null);

  // Lock body scroll and save previous focus
  useEffect(() => {
    if (!open) return;

    previousActiveRef.current = document.activeElement as HTMLElement | null;
    document.body.style.overflow = "hidden";
    document.documentElement.style.overflow = "hidden";
    closeRef.current?.focus();

    return () => {
      document.body.style.overflow = "";
      document.documentElement.style.overflow = "";
      previousActiveRef.current?.focus();
    };
  }, [open]);

  // Focus trap + Escape
  const handleKeyDown = useCallback(
    (e: React.KeyboardEvent) => {
      if (e.key === "Escape") {
        onClose();
        return;
      }

      if (e.key !== "Tab" || !dialogRef.current) return;

      const focusable = dialogRef.current.querySelectorAll<HTMLElement>(
        'button, [href], input, select, textarea, [tabindex]:not([tabindex="-1"])'
      );
      if (focusable.length === 0) return;

      const first = focusable[0]!;
      const last = focusable[focusable.length - 1]!;

      if (e.shiftKey) {
        if (document.activeElement === first) {
          e.preventDefault();
          last.focus();
        }
      } else {
        if (document.activeElement === last) {
          e.preventDefault();
          first.focus();
        }
      }
    },
    [onClose],
  );

  if (!open) return null;

  return (
    <div
      style={{
        position: "fixed",
        inset: 0,
        zIndex: 180,
        display: "flex",
        alignItems: "center",
        justifyContent: "center",
        background: "rgba(4, 11, 36, 0.72)",
        backdropFilter: "blur(8px)",
      }}
      role="presentation"
      onClick={onClose}
    >
      <div
        ref={dialogRef}
        style={{
          width: "100%",
          height: "100%",
          display: "grid",
          gap: 18,
          padding: 48,
          overflowY: "auto",
          alignContent: "center",
          background: "linear-gradient(180deg, rgba(16, 39, 111, 0.98), rgba(10, 24, 71, 1))",
          color: "#fff",
        }}
        role="dialog"
        aria-modal="true"
        aria-label="How to play"
        onClick={(e) => e.stopPropagation()}
        onKeyDown={handleKeyDown}
      >
        <div style={{ display: "flex", justifyContent: "space-between", alignItems: "flex-start", gap: 16 }}>
          <div>
            <p style={{ fontSize: 13, fontWeight: 800, letterSpacing: "0.12em", textTransform: "uppercase", color: "rgba(255,255,255,0.74)", marginBottom: 8 }}>
              How To Play
            </p>
            <h2 style={{ fontSize: "clamp(28px, 4vw, 48px)", lineHeight: 0.92, letterSpacing: "-0.06em" }}>
              Use simple hand shapes to cast
            </h2>
          </div>
          <button
            ref={closeRef}
            type="button"
            onClick={onClose}
            aria-label="Close dialog"
            style={{
              minWidth: 48,
              minHeight: 48,
              padding: "10px 20px",
              borderRadius: 16,
              border: "1px solid rgba(255,255,255,0.18)",
              background: "rgba(255,255,255,0.1)",
              color: "#fff",
              fontWeight: 700,
              fontSize: 14,
              cursor: "pointer",
            }}
          >
            Close
          </button>
        </div>

        <p style={{ fontSize: 16, lineHeight: 1.65, color: "rgba(255,255,255,0.84)", maxWidth: 600 }}>
          Keep your drawing hand in view of the camera. The game only listens to a few gestures while you trace.
        </p>

        <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit, minmax(240px, 1fr))", gap: 16, marginTop: 8 }}>
          {[
            { icon: "☝️", iconLabel: "Pointing finger", title: "Point with your index finger to draw", desc: "Trace the graph with one pointed index finger. That is the only hand shape that adds to your drawing path." },
            { icon: "✊ ✌️", iconLabel: "Fist and peace sign", title: "Fists and peace signs do nothing", desc: "If your hand is closed or making a peace sign, the game ignores it. Those shapes will not draw and will not submit." },
            { icon: "🖐️", iconLabel: "Open palm", title: "Show an open palm to finish", desc: "Turn your palm toward the camera when you are done drawing. That starts grading and tells the game to score your trace." },
            { icon: "🧪", iconLabel: "Potion bottle", title: "Grab powerups with your other hand", desc: "Powerups appear on the grid during battle. Use your non-drawing hand to hover over them for a second to collect. Potions heal you, attack spells damage opponents, and multipliers boost your next score." },
          ].map((step) => (
            <article
              key={step.title}
              style={{
                display: "grid",
                gridTemplateColumns: "56px 1fr",
                gap: 14,
                padding: 20,
                borderRadius: 20,
                background: "rgba(255,255,255,0.08)",
                border: "1px solid rgba(255,255,255,0.1)",
              }}
            >
              <div
                style={{ fontSize: 32, display: "flex", alignItems: "center", justifyContent: "center" }}
                role="img"
                aria-label={step.iconLabel}
              >
                {step.icon}
              </div>
              <div>
                <strong style={{ fontSize: 15, lineHeight: 1.3 }}>{step.title}</strong>
                <p style={{ fontSize: 14, lineHeight: 1.6, color: "rgba(255,255,255,0.7)", marginTop: 6 }}>
                  {step.desc}
                </p>
              </div>
            </article>
          ))}
        </div>
      </div>
    </div>
  );
}
