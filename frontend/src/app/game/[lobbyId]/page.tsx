import { GameClient } from "./game-client";

type PageProps = {
  params: {
    lobbyId: string;
  };
};

export default function LobbyPage({ params }: PageProps) {
  return <GameClient lobbyId={params.lobbyId} />;
}
