import { Suspense } from "react";
import { SoloGameClient } from "./solo-game-client";

export default function SoloGamePage() {
  return (
    <Suspense fallback={null}>
      <SoloGameClient />
    </Suspense>
  );
}
