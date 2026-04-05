"use client";

type SkeletonProps = {
  width?: number | string;
  height?: number | string;
  borderRadius?: number | string;
  style?: React.CSSProperties;
  className?: string;
};

export function Skeleton({
  width = "100%",
  height = 24,
  borderRadius = 12,
  style,
  className,
}: SkeletonProps) {
  return (
    <div
      aria-hidden="true"
      className={className}
      style={{
        width,
        height,
        borderRadius,
        background: "rgba(255, 255, 255, 0.12)",
        animation: "skeleton-pulse 1.5s ease-in-out infinite",
        ...style,
      }}
    />
  );
}
