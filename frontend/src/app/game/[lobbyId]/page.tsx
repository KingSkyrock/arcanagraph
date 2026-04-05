import type { Metadata } from "next";
import { GameClient } from "./game-client";

export const metadata: Metadata = {
  title: "Game",
  description: "Active Arcanagraph multiplayer match",
};

export default async function GamePage({
  params,
}: {
  params: Promise<{ lobbyId: string }>;
}) {
  const { lobbyId } = await params;

  return <GameClient lobbyId={lobbyId} />;
}
