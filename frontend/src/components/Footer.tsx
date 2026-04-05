"use client";

export function Footer() {
  return (
    <footer
      style={{
        padding: "48px 24px",
        textAlign: "center",
        color: "rgba(255, 255, 255, 0.6)",
        fontSize: 14,
        fontWeight: 600,
      }}
    >
      Made with{" "}
      <span style={{ color: "#ef4444", fontSize: 18, verticalAlign: "middle" }}>
        ♥
      </span>{" "}
      by Team ArcanaGraph &mdash; DiamondHacks 2026
    </footer>
  );
}
